// A walk-in request nobody answered lapses when its day ends (migrations
// 081/082, applied 2026-08-17).
//
// `pending_approval` was the one status the day-end sweep could not reach: 066
// closes APPROVALS, and a request that was never approved has no approval to
// close. Console.loadVisits carries `pending_approval` with no date bound — on
// purpose, so overnight work is not dropped at midnight — so every unanswered
// request since the app shipped stayed on the HOD's desk for ever, and Reports
// went on describing it as a decision that was coming.
//
// The three assertions that matter, and why each is not obvious:
//   1. Only a request whose OWN day has ended lapses (077's predicate). Today's
//      request survives no matter what hour the sweep runs.
//   2. It writes NO audit row and NO notification. Nobody decided, so there is
//      no actor and no instant — which is precisely why `lapsed` is a status of
//      its own and not `expired` (that one implies an approval, and Reports
//      prints an approver for it).
//   3. An HOD's sweep is department-scoped, and it goes through the UPDATE
//      trigger under the HOD's own JWT — so `pending_approval -> lapsed` had to
//      be added to the state machine or the human entry point would raise
//      'Invalid status transition' on every row.
//
// Runs against the live Supabase project in .env (seeded demo users, password
// demo123), fixtures via service role — same pattern as noShowWorkflow.test.ts,
// including its clock-skew rule: every time window is captured 60 s in the past.
import 'dotenv/config';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const URL = process.env.VITE_SUPABASE_URL!;
const ANON = process.env.VITE_SUPABASE_ANON_KEY!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const PASS = 'demo123';

if (!URL || !ANON || !SERVICE) {
  throw new Error('lapsedRequests.test.ts requires VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY in .env');
}

const noSession = { auth: { autoRefreshToken: false, persistSession: false } };
const svc = createClient(URL, SERVICE, noSession);

async function login(email: string): Promise<SupabaseClient> {
  const c = createClient(URL, ANON, noSession);
  const { error } = await c.auth.signInWithPassword({ email, password: PASS });
  if (error) throw new Error(`login ${email}: ${error.message}`);
  return c;
}

let hodIT: SupabaseClient;
let itDept = '', hrDept = '', hodItId = '';
let visitorId = '';
let itOldId = '', itTodayId = '', hrOldId = '';
let startedAt = '';

beforeAll(async () => {
  hodIT = await login('hod.it@demo.vms');

  const { data: depts } = await svc.from('departments').select('id, code').in('code', ['IT', 'HR']);
  itDept = depts!.find((d) => d.code === 'IT')!.id;
  hrDept = depts!.find((d) => d.code === 'HR')!.id;

  const { data: profs } = await svc.from('profiles').select('id, email').eq('email', 'hod.it@demo.vms');
  hodItId = profs![0]!.id;

  const { data: vis, error: visErr } = await svc.from('visitors')
    .upsert({ phone: '9998887773', full_name: 'Lapsed Request Test Visitor', vendor_name: 'TestCo' }, { onConflict: 'phone' })
    .select().single();
  if (visErr) throw visErr;
  visitorId = vis!.id;

  // A pending request has no `scheduled_for` — WalkInRequest and the kiosk are
  // its only writers and both insert null — so `created_at` IS its moment, and
  // backdating it is the only way to age one. It cannot be done on the insert:
  // `generate_visit_ref` (a BEFORE INSERT trigger) stamps `new.created_at :=
  // now()` unconditionally, which is why noShowWorkflow.test.ts ages its rows
  // through `scheduled_for` instead. A service-role UPDATE can, because
  // `enforce_visit_update_rules` — the trigger that otherwise pins created_at to
  // its old value — short-circuits on is_service_role().
  //
  // Sequential: the ref-number trigger computes max+1 by reading the table, so
  // parallel inserts race into duplicate refs.
  async function mkPending(dept: string, createdAt?: string): Promise<string> {
    const { data, error } = await svc.from('visits')
      .insert({
        visitor_id: visitorId, department_id: dept, host_id: hodItId, purpose: 'meeting',
        carrying_material: false, status: 'pending_approval', scheduled_for: null,
      })
      .select('id').single();
    if (error) throw error;
    if (createdAt) {
      const { error: ageErr } = await svc.from('visits')
        .update({ created_at: createdAt }).eq('id', data!.id);
      if (ageErr) throw ageErr;
    }
    return data!.id;
  }

  startedAt = new Date(Date.now() - 60_000).toISOString();
  const twoDaysAgo = new Date(Date.now() - 2 * 86_400_000).toISOString();
  itOldId = await mkPending(itDept, twoDaysAgo);
  itTodayId = await mkPending(itDept);
  hrOldId = await mkPending(hrDept, twoDaysAgo);
}, 120_000);

afterAll(async () => {
  const visitIds = [itOldId, itTodayId, hrOldId].filter(Boolean);
  if (visitIds.length) {
    // The registration trigger notifies the host of each pending request; those
    // rows are ours and go with the visits.
    await svc.from('notifications').delete().in('related_id', visitIds);
    await svc.from('visits').delete().in('id', visitIds);
  }
  if (visitorId) await svc.from('visitors').delete().eq('id', visitorId).then(() => undefined, () => undefined);
  await hodIT?.auth.signOut();
}, 60_000);

async function statusOf(id: string): Promise<string> {
  const { data } = await svc.from('visits').select('status').eq('id', id).single();
  return data!.status as string;
}

// ─────────────────────────────────────────────────────────────────────────────

describe('082: an unanswered walk-in request lapses at day end', () => {
  it('an HOD sweep closes their own department\'s stale request and leaves today\'s alone', async () => {
    // Through mark_no_shows(), which runs the UPDATE under the HOD's own JWT —
    // so this also proves the trigger accepts pending_approval -> lapsed.
    //
    // The RETURN COUNT IS NOT ASSERTED, and that is not laziness. The sweep is
    // idempotent by design (077), so the row's END STATE is the fact this test
    // is about; the count only says who got there first. noShowWorkflow.test.ts
    // sweeps the SAME department under the SAME HOD, vitest runs the two files
    // in parallel, and whichever call lands second correctly reports 0 rows —
    // its work was already done. Asserting >= 1 made a passing system fail on
    // scheduling order alone.
    const { error } = await hodIT.rpc('mark_no_shows');
    expect(error).toBeNull();

    expect(await statusOf(itOldId)).toBe('lapsed');
    // 077's rule: the day containing the VISIT's own moment must have ended, not
    // today's. A request raised this morning is still a decision the host can
    // make this afternoon, whatever hour the hourly job fires.
    expect(await statusOf(itTodayId)).toBe('pending_approval');
  }, 30_000);

  it('does not reach another department', async () => {
    // The IT HOD's sweep above ran while this HR row was equally stale.
    expect(await statusOf(hrOldId)).toBe('pending_approval');
  }, 30_000);

  it('records no approval — no audit row, no notification', async () => {
    // The whole reason `lapsed` is not `expired`. `log_visit_approval` has no
    // branch for this transition and `trg_notify_no_show` fires on 'no_show'
    // alone, so nothing in the record can be read as a host having decided.
    const { data: audit } = await svc.from('audit_logs')
      .select('action').eq('entity_id', itOldId).gte('created_at', startedAt);
    expect(audit ?? []).toHaveLength(0);

    const { data: notes } = await svc.from('notifications')
      .select('type').eq('related_id', itOldId).gte('created_at', startedAt);
    expect((notes ?? []).map((n) => n.type)).not.toContain('visit_no_show');
  }, 30_000);

  it('is idempotent — a second global sweep re-closes nothing', async () => {
    // The predicate says "the day has ENDED", which is true whenever evaluated,
    // so re-running can only ever match rows that are still open. The first call
    // may still close the HR row above; the second must find nothing at all.
    await svc.rpc('sweep_no_shows_daily');
    const { data, error } = await svc.rpc('sweep_no_shows_daily');
    expect(error).toBeNull();
    expect(data).toBe(0);
    expect(await statusOf(hrOldId)).toBe('lapsed');
  }, 30_000);

  it('the sweep is service-role only; mark_no_shows stays the human entry point', async () => {
    const { error } = await hodIT.rpc('sweep_no_shows_daily');
    expect(error).not.toBeNull();
  }, 30_000);
});
