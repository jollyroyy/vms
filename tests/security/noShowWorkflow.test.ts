// The no-show workflow (migration 075, applied 2026-08-13):
//   1. 20:00 IST — send_no_show_summary() writes ONE forecast per department
//      HOD: "N approvals scheduled for today never arrived. They will be
//      closed as no-shows at 10 PM and the passes will become void."
//   2. The day ends at 22:00 IST, not midnight. close_stale_approvals() — via
//      the HOD-scoped mark_no_shows() here, the hourly cron in production —
//      marks every un-arrived approval whose moment fell before close as
//      `no_show`, and the per-visit trigger writes "the pass is now void,
//      raise a new request". No reactivation is surfaced anywhere.
//   3. Only the scheduled jobs (service role) can send the summary or run the
//      global sweep; an HOD can only sweep their own department.
//
// Runs against the live Supabase project in .env (seeded demo users, password
// demo123). Fixtures via service role in beforeAll, removed in afterAll —
// same pattern as auditLogsRls.test.ts. send_no_show_summary accepts p_force
// to bypass the once-per-IST-day dedupe, so this file can prove the count
// without racing the real 20:00 job.
import 'dotenv/config';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { istDayStart } from '../../src/lib/visitExpiry';

const URL = process.env.VITE_SUPABASE_URL!;
const ANON = process.env.VITE_SUPABASE_ANON_KEY!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const PASS = 'demo123';

if (!URL || !ANON || !SERVICE) {
  throw new Error('noShowWorkflow.test.ts requires VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY in .env');
}

const noSession = { auth: { autoRefreshToken: false, persistSession: false } };
const svc = createClient(URL, SERVICE, noSession);

async function login(email: string): Promise<SupabaseClient> {
  const c = createClient(URL, ANON, noSession);
  const { error } = await c.auth.signInWithPassword({ email, password: PASS });
  if (error) throw new Error(`login ${email}: ${error.message}`);
  return c;
}

let hodIT: SupabaseClient, hodHR: SupabaseClient;
let itDept = '', hrDept = '', itDeptName = '';
let hodItId = '', hodHrId = '';
let visitorId = '';
let itOldId = '', itTodayId = '', hrOldId = '';
let startedAt = '';

beforeAll(async () => {
  [hodIT, hodHR] = await Promise.all([login('hod.it@demo.vms'), login('hod.hr@demo.vms')]);

  const { data: depts } = await svc.from('departments').select('id, name, code').in('code', ['IT', 'HR']);
  itDept = depts!.find((d) => d.code === 'IT')!.id;
  itDeptName = depts!.find((d) => d.code === 'IT')!.name;
  hrDept = depts!.find((d) => d.code === 'HR')!.id;

  const { data: profs } = await svc.from('profiles').select('id, email, role').in('email', ['hod.it@demo.vms', 'hod.hr@demo.vms']);
  hodItId = profs!.find((p) => p.email === 'hod.it@demo.vms')!.id;
  hodHrId = profs!.find((p) => p.email === 'hod.hr@demo.vms')!.id;

  const { data: vis, error: visErr } = await svc.from('visitors')
    .upsert({ phone: '9998887774', full_name: 'No Show Workflow Test Visitor', vendor_name: 'TestCo' }, { onConflict: 'phone' })
    .select().single();
  if (visErr) throw visErr;
  visitorId = vis!.id;

  // Sequential inserts: the ref-number trigger computes max+1 by reading the
  // table, so parallel inserts race into duplicate refs (memory.md SB-03).
  async function mkVisit(dept: string, scheduledFor: string): Promise<string> {
    const { data, error } = await svc.from('visits')
      .insert({
        visitor_id: visitorId, department_id: dept, host_id: hodItId, purpose: 'meeting',
        carrying_material: false, status: 'approved', scheduled_for: scheduledFor,
      })
      .select('id').single();
    if (error) throw error;
    return data!.id;
  }

  const twoDaysAgo = new Date(Date.now() - 2 * 86_400_000).toISOString();
  const todayMorning = new Date(istDayStart(new Date()).getTime() + 6 * 3_600_000).toISOString();
  startedAt = new Date().toISOString();
  itOldId = await mkVisit(itDept, twoDaysAgo);
  itTodayId = await mkVisit(itDept, todayMorning);
  hrOldId = await mkVisit(hrDept, twoDaysAgo);
}, 120_000);

afterAll(async () => {
  const visitIds = [itOldId, itTodayId, hrOldId].filter(Boolean);
  // Both new types: the per-visit rows (recipient = host) and every HOD's
  // summary row — the seed creates two HODs per department.
  await svc.from('notifications').delete()
    .in('type', ['visit_no_show', 'visit_no_show_summary']).gte('created_at', startedAt);
  if (visitIds.length) await svc.from('visits').delete().in('id', visitIds);
  if (visitorId) await svc.from('visitors').delete().eq('id', visitorId).then(() => undefined, () => undefined);
  await Promise.all([hodIT, hodHR].map((c) => c?.auth.signOut()));
}, 60_000);

// ─────────────────────────────────────────────────────────────────────────────

describe('075: the no-show workflow — 8 PM forecast, 10 PM void', () => {
  it('send_no_show_summary writes one forecast per department HOD, counting today\'s un-arrived approvals', async () => {
    // IT has exactly one approval scheduled for today (itTodayId); the other
    // two fixtures are two days old and belong to no today-window. p_force
    // skips the dedupe so this cannot race the real 20:00 job.
    const { data, error } = await svc.rpc('send_no_show_summary', { p_force: true });
    expect(error).toBeNull();
    // The seed creates two HODs per department, and each gets their own row.
    expect(data).toBeGreaterThanOrEqual(1);

    const { data: rows } = await svc.from('notifications').select('*')
      .eq('recipient_id', hodItId).eq('type', 'visit_no_show_summary').gte('created_at', startedAt);
    expect(rows ?? []).toHaveLength(1);
    const row = rows![0];
    expect(row.body).toContain(`1 approval in ${itDeptName}`);
    expect(row.body).toMatch(/10 PM/);
    expect(row.body).toMatch(/will become void/);
    // A summary, not a visit: no related_id, so the Overview shows no
    // "More information" link that could resolve to nothing.
    expect(row.related_id).toBeNull();
  }, 30_000);

  it('the HOD-scoped sweep closes only its own department — yesterday\'s AND today\'s', async () => {
    const { data, error } = await hodIT.rpc('mark_no_shows');
    expect(error).toBeNull();
    expect(data).toBe(2);

    const { data: rows } = await svc.from('visits').select('id, status')
      .in('id', [itOldId, itTodayId, hrOldId]);
    const byId = Object.fromEntries(rows!.map((r) => [r.id, r.status]));
    expect(byId[itOldId]).toBe('no_show');
    expect(byId[itTodayId]).toBe('no_show');
    // Department scope held: the HR fixture is untouched.
    expect(byId[hrOldId]).toBe('approved');
  }, 30_000);

  it('each closed visit writes a per-visit notification with the void copy', async () => {
    // Recipient is "a" department HOD (notify_no_show uses limit 1 and the
    // seed has two HODs per department), so match on type + related visit.
    const { data, error } = await svc.from('notifications').select('*')
      .eq('type', 'visit_no_show').in('related_id', [itOldId, itTodayId]);
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(2);
    for (const n of data!) {
      expect(n.body).toMatch(/pass is now void/);
      expect(n.body).toMatch(/raise a new pre-approval request/);
    }
  }, 30_000);

  it('an HOD can read every notification addressed to them through RLS', async () => {
    const { data, error } = await hodIT.from('notifications').select('id')
      .gte('created_at', startedAt);
    expect(error).toBeNull();
    // At least the summary row; per-visit rows may have gone to the seed's
    // second IT HOD (notify_no_show picks one with limit 1).
    expect(data ?? []).not.toHaveLength(0);
  }, 30_000);

  it('neither the summary nor the global sweep is callable by an HOD', async () => {
    const summary = await hodIT.rpc('send_no_show_summary', { p_force: true });
    expect(summary.error).not.toBeNull();
    const sweep = await hodIT.rpc('sweep_no_shows_daily');
    expect(sweep.error).not.toBeNull();
  }, 30_000);

  it('a quiet department gets no summary, and an HR sweep closes HR only', async () => {
    // Nothing today-open anywhere now: the forecast inserts no rows at all.
    const { data, error } = await svc.rpc('send_no_show_summary', { p_force: true });
    expect(error).toBeNull();
    expect(data).toBe(0);

    const { data: hrSummary } = await svc.from('notifications').select('id')
      .eq('recipient_id', hodHrId).eq('type', 'visit_no_show_summary');
    expect(hrSummary ?? []).toHaveLength(0);

    const { data: n, error: hrErr } = await hodHR.rpc('mark_no_shows');
    expect(hrErr).toBeNull();
    expect(n).toBe(1);
    const { data: rows } = await svc.from('visits').select('status').eq('id', hrOldId);
    expect(rows![0].status).toBe('no_show');
  }, 30_000);
});