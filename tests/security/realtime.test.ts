// @vitest-environment node
//
// The suite is forced onto the plain Node environment (instead of the
// project-wide jsdom default) because jsdom's polyfilled `Event`/`WebSocket`
// classes are not the same objects as the ones undici's native WebSocket
// (used by @supabase/realtime-js) expects — under jsdom this throws
// `TypeError: The "event" argument must be an instance of Event` deep inside
// the websocket layer and every channel subscribe times out. Real
// `postgres_changes` delivery needs Node's native WebSocket, not jsdom's.
//
// Regression guard for the Realtime publication bug (migration 038).
//
// BUG: every page opens a `postgres_changes` channel (10 subscriptions on
// `visits`, 2 on `notifications`, 2 on `gate_passes`), filtering server-side
// on `visits.department_id` / `notifications.recipient_id`. But the
// `supabase_realtime` publication contained ONLY `gatepass.gate_passes` — no
// public table was published, so Postgres never emitted a single change event
// and every one of those subscriptions was silently dead (UI only refreshed
// on manual reload).
//
// FIX (038_enable_realtime_publication.sql, already applied to the live DB):
//   1. Added public.visits / public.notifications / public.gate_passes to the
//      supabase_realtime publication.
//   2. Set replica identity FULL on all three — required because the app
//      filters UPDATE/DELETE events on non-PK columns (department_id,
//      recipient_id); without FULL those filtered events silently never match.
//
// This file proves the fix two ways:
//   (1) CONFIGURATION — fast, deterministic checks directly on
//       pg_publication_tables / pg_class.relreplident.
//   (2) BEHAVIOUR — an authenticated client actually subscribes, waits for
//       SUBSCRIBED, and receives real INSERT + UPDATE events from a live write
//       via the service-role client.
//
// NOTE on (1) — investigated and confirmed before writing this file:
//   - supabase-js/PostgREST on this project only expose the `public` schema.
//     Requesting `db.schema('pg_catalog')` or `db.schema('information_schema')`
//     via the JS client returns `"Invalid schema: ..."` from PostgREST.
//   - There is no exec-sql-style RPC anywhere in supabase/migrations that
//     reaches pg_publication_tables / pg_class from the JS client.
//   - There is no SUPABASE_DB_URL/DATABASE_URL in .env for a direct `pg`
//     connection (the DB password is a separate secret that isn't checked in).
//   So (1) genuinely cannot run through the anon/service-role JS client alone.
//   It IS implemented for real via `pg` (already a devDependency) and will run
//   the moment a direct Postgres connection string is exported as
//   SUPABASE_DB_URL or DATABASE_URL. Until then it reports itself SKIPPED with
//   an explicit reason at run time — never faked as green, never deleted.
import 'dotenv/config';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient, type SupabaseClient, type RealtimePostgresChangesPayload } from '@supabase/supabase-js';

const URL = process.env.VITE_SUPABASE_URL!;
const ANON = process.env.VITE_SUPABASE_ANON_KEY!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const DB_URL = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL || '';
const PASS = 'demo123';
const REALTIME_TABLES = ['visits', 'notifications', 'gate_passes'] as const;

if (!URL || !ANON || !SERVICE) {
  throw new Error('realtime.test.ts requires VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY in .env');
}

const noSession = { auth: { autoRefreshToken: false, persistSession: false } };
const svc = createClient(URL, SERVICE, noSession);

async function login(email: string): Promise<SupabaseClient> {
  const c = createClient(URL, ANON, noSession);
  const { error } = await c.auth.signInWithPassword({ email, password: PASS });
  if (error) throw new Error(`login ${email}: ${error.message}`);
  return c;
}

/** Polls `arr` for an element matching `pred`; rejects with a clear message (incl. what WAS received) on timeout. */
function waitFor<T>(arr: T[], pred: (t: T) => boolean, timeoutMs: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const iv = setInterval(() => {
      const hit = arr.find(pred);
      if (hit) {
        clearInterval(iv);
        resolve(hit);
        return;
      }
      if (Date.now() - start > timeoutMs) {
        clearInterval(iv);
        reject(new Error(
          `Timed out after ${timeoutMs}ms waiting for: ${label}. ` +
          `Events received on this channel so far: ${JSON.stringify(arr.map((e) => (e as { eventType?: string }).eventType ?? e))}`
        ));
      }
    }, 150);
  });
}

/** Waits for a Realtime channel to reach SUBSCRIBED before any write happens — avoids the #1 flake source. */
function waitForSubscribed(channel: ReturnType<SupabaseClient['channel']>, timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Channel did not reach SUBSCRIBED within ${timeoutMs}ms — realtime handshake failed`)),
      timeoutMs
    );
    channel.subscribe((status, err) => {
      if (status === 'SUBSCRIBED') {
        clearTimeout(timer);
        resolve();
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        clearTimeout(timer);
        reject(new Error(`Channel subscribe failed: status=${status}${err ? ' err=' + err.message : ''}`));
      }
    });
  });
}

let hodIT: SupabaseClient;
let itDept = '';
let hodItId = '';
let visitorId = '';
const cleanupVisits: string[] = [];

beforeAll(async () => {
  hodIT = await login('hod.it@demo.vms');

  const { data: dept, error: deptErr } = await svc.from('departments').select('id').eq('code', 'IT').single();
  if (deptErr) throw deptErr;
  itDept = dept!.id;

  const { data: prof, error: profErr } = await svc.from('profiles').select('id').eq('email', 'hod.it@demo.vms').single();
  if (profErr) throw profErr;
  hodItId = prof!.id;

  const { data: vis, error: visErr } = await svc.from('visitors')
    .upsert({ phone: '9998887788', full_name: 'Realtime Test Visitor' }, { onConflict: 'phone' })
    .select().single();
  if (visErr) throw visErr;
  visitorId = vis!.id;
}, 60_000);

afterAll(async () => {
  if (cleanupVisits.length) await svc.from('visits').delete().in('id', cleanupVisits);
  if (visitorId) await svc.from('visitors').delete().eq('id', visitorId).then(() => undefined, () => undefined);
  await hodIT?.auth.signOut();
}, 60_000);

// ─────────────────────────────────────────────────────────────────────────────
// (1) CONFIGURATION — the fast, deterministic regression guard.
// ─────────────────────────────────────────────────────────────────────────────

describe('Realtime configuration (migration 038 regression guard)', () => {
  if (!DB_URL) {
    it.skip(
      'public.visits / public.notifications / public.gate_passes are members of the ' +
      'supabase_realtime publication, each with replica identity FULL ' +
      '— SKIPPED: no direct Postgres connection available in this environment. ' +
      'supabase-js only exposes the `public` schema via PostgREST (pg_catalog / ' +
      'information_schema both returned "Invalid schema" when probed), and no ' +
      'SQL-execution RPC exists in supabase/migrations to reach pg_publication_tables ' +
      '/ pg_class from the anon or service-role client. Set SUPABASE_DB_URL (or ' +
      'DATABASE_URL) to a direct Postgres connection string to activate this check.',
      () => undefined
    );
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let pg: any;

    beforeAll(async () => {
      const { Client } = await import('pg');
      pg = new Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });
      await pg.connect();
    }, 30_000);

    afterAll(async () => {
      await pg?.end();
    }, 15_000);

    it('all three tables are members of the supabase_realtime publication', async () => {
      const { rows } = await pg.query(
        `select tablename from pg_publication_tables
         where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = any($1)`,
        [REALTIME_TABLES]
      );
      const published = new Set(rows.map((r: { tablename: string }) => r.tablename));
      for (const t of REALTIME_TABLES) {
        expect(published.has(t), `public.${t} is NOT in the supabase_realtime publication — its realtime events will never fire`).toBe(true);
      }
    }, 15_000);

    it('all three tables have replica identity FULL (relreplident = \'f\')', async () => {
      const { rows } = await pg.query(
        `select relname, relreplident from pg_class
         where relnamespace = 'public'::regnamespace and relname = any($1)`,
        [REALTIME_TABLES]
      );
      const identity = new Map(rows.map((r: { relname: string; relreplident: string }) => [r.relname, r.relreplident]));
      for (const t of REALTIME_TABLES) {
        expect(identity.get(t), `public.${t} replica identity must be FULL ('f') for department_id/recipient_id filters to match UPDATE/DELETE`).toBe('f');
      }
    }, 15_000);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// (2) BEHAVIOUR — actual end-to-end event delivery against the live database.
// ─────────────────────────────────────────────────────────────────────────────

describe('Realtime event delivery (migration 038 regression guard)', () => {
  it('HOD subscriber filtered on department_id receives a live INSERT then UPDATE on public.visits', async () => {
    const received: RealtimePostgresChangesPayload<Record<string, unknown>>[] = [];
    const channel = hodIT.channel(`realtime-test-visits-${Date.now()}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'visits', filter: `department_id=eq.${itDept}` },
        (payload) => { received.push(payload); }
      );

    try {
      await waitForSubscribed(channel, 15_000);

      // --- INSERT: proves publication membership ---
      const { data: visit, error: insErr } = await svc.from('visits')
        .insert({ visitor_id: visitorId, department_id: itDept, host_id: hodItId, purpose: 'other', carrying_material: false })
        .select('id, status').single();
      expect(insErr).toBeNull();
      const visitId = visit!.id;
      cleanupVisits.push(visitId);

      const insertEvt = await waitFor(
        received,
        (p) => p.eventType === 'INSERT' && (p.new as { id?: string }).id === visitId,
        15_000,
        `INSERT event on public.visits for id=${visitId} (department_id=${itDept} filter)`
      );
      expect((insertEvt.new as { department_id?: string }).department_id).toBe(itDept);
      expect((insertEvt.new as { status?: string }).status).toBe('pending_approval');

      // --- UPDATE: proves replica identity FULL + department_id filter both work ---
      const { error: updErr } = await svc.from('visits').update({ status: 'approved' }).eq('id', visitId);
      expect(updErr).toBeNull();

      const updateEvt = await waitFor(
        received,
        (p) => p.eventType === 'UPDATE' && (p.new as { id?: string }).id === visitId && (p.new as { status?: string }).status === 'approved',
        15_000,
        `UPDATE event on public.visits for id=${visitId} (requires replica identity FULL — this is the key regression case)`
      );
      expect((updateEvt.new as { status?: string }).status).toBe('approved');
      expect((updateEvt.new as { department_id?: string }).department_id).toBe(itDept);
    } finally {
      await hodIT.removeChannel(channel);
    }
  }, 60_000);
});
