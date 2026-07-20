// CHECK for goal.md S9 + S10 (🎯, SECURITY BASELINE SEC-1/2/3/5) — FR ref: NFR-04, FR-CAM-13
//
// These are DENIAL tests: they log in as the WRONG role and assert the backend says no.
// They run against the live Supabase project in .env, using the seeded demo users
// (scripts/seed.ts, password Demo@1234). Fixtures are created via the service-role
// client in beforeAll and removed in afterAll.
//
// Enforcement under test:
//   002_rls.sql  — role policies        004 — dept→JWT sync
//   006          — JWT-based HOD scope  007 — approve/reject security-definer RPCs
//   008          — server authority: immutable ref/created_at, server-clock
//                  check-in/out, status state machine, dept-scoped reads/inserts
import 'dotenv/config';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const URL = process.env.VITE_SUPABASE_URL!;
const ANON = process.env.VITE_SUPABASE_ANON_KEY!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const PASS = 'Demo@1234';
const REF_RE = /^VIS-\d{8}-\d{4}$/;

if (!URL || !ANON || !SERVICE) {
  throw new Error('rls.test.ts requires VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY in .env');
}

const noSession = { auth: { autoRefreshToken: false, persistSession: false } };
const svc = createClient(URL, SERVICE, noSession);

async function login(email: string): Promise<SupabaseClient> {
  const c = createClient(URL, ANON, noSession);
  const { error } = await c.auth.signInWithPassword({ email, password: PASS });
  if (error) throw new Error(`login ${email}: ${error.message}`);
  return c;
}

// role clients + fixtures
let guard: SupabaseClient, hodIT: SupabaseClient, hodFIN: SupabaseClient, staff: SupabaseClient;
let anon: SupabaseClient; // never signed in
let itDept = '', hrDept = '';
let hodItId = '', staffId = '';
let visitorId = '';
// fixture visits (all IT department): see beforeAll
let vDeny = '', vApprove = '', vReject = '', vApproved = '', vCheckedIn = '', vHrPending = '';
const cleanupVisits: string[] = [];
const cleanupPasses: string[] = [];
const PROBE_PATH = 'rls-probe/probe.txt';

beforeAll(async () => {
  anon = createClient(URL, ANON, noSession);
  [guard, hodIT, hodFIN, staff] = await Promise.all([
    login('guard@demo.vms'), login('hod.it@demo.vms'), login('hod.fin@demo.vms'), login('staff@demo.vms'),
  ]);

  const { data: depts } = await svc.from('departments').select('id, code').in('code', ['IT', 'HR']);
  itDept = depts!.find((d) => d.code === 'IT')!.id;
  hrDept = depts!.find((d) => d.code === 'HR')!.id;

  const { data: profs } = await svc.from('profiles').select('id, email').in('email', ['hod.it@demo.vms', 'staff@demo.vms']);
  hodItId = profs!.find((p) => p.email === 'hod.it@demo.vms')!.id;
  staffId = profs!.find((p) => p.email === 'staff@demo.vms')!.id;

  const { data: vis, error: visErr } = await svc.from('visitors')
    .upsert({ phone: '9998887771', full_name: 'RLS Test Visitor', company: 'TestCo' }, { onConflict: 'phone' })
    .select().single();
  if (visErr) throw visErr;
  visitorId = vis!.id;

  // One visit per scenario; insert (trigger sets ref) then service-patch status where needed.
  async function mkVisit(dept: string, status: string): Promise<string> {
    const { data, error } = await svc.from('visits')
      .insert({ visitor_id: visitorId, department_id: dept, host_id: hodItId, purpose: 'meeting', carrying_material: false })
      .select('id').single();
    if (error) throw error;
    if (status !== 'pending_approval') {
      const patch: Record<string, unknown> = { status };
      if (status === 'checked_in') patch.checked_in_at = new Date().toISOString();
      const { error: upErr } = await svc.from('visits').update(patch).eq('id', data!.id);
      if (upErr) throw upErr;
    }
    cleanupVisits.push(data!.id);
    return data!.id;
  }
  // Sequential inserts: the ref-number trigger computes max+1 by reading the
  // table, so parallel inserts race into duplicate refs (memory.md SB-03).
  vDeny = await mkVisit(itDept, 'pending_approval');
  vApprove = await mkVisit(itDept, 'pending_approval');
  vReject = await mkVisit(itDept, 'pending_approval');
  vApproved = await mkVisit(itDept, 'approved');
  vCheckedIn = await mkVisit(itDept, 'checked_in');
  vHrPending = await mkVisit(hrDept, 'pending_approval');

  // Storage probe object for S10 (create bucket if the project doesn't have it yet)
  await svc.storage.createBucket('visitor-photos', { public: false }).catch(() => undefined);
  const { error: upErr } = await svc.storage.from('visitor-photos')
    .upload(PROBE_PATH, new Blob(['rls probe — not a real photo']), { upsert: true, contentType: 'text/plain' });
  if (upErr) throw new Error(`probe upload: ${upErr.message}`);
}, 120_000);

afterAll(async () => {
  if (cleanupPasses.length) await svc.from('gate_passes').delete().in('id', cleanupPasses);
  if (cleanupVisits.length) {
    await svc.from('notifications').delete().in('related_id', cleanupVisits);
    await svc.from('visits').delete().in('id', cleanupVisits);
  }
  if (visitorId) await svc.from('visitors').delete().eq('id', visitorId).then(() => undefined, () => undefined);
  await svc.storage.from('visitor-photos').remove([PROBE_PATH]);
  await Promise.all([guard, hodIT, hodFIN, staff].map((c) => c?.auth.signOut()));
}, 60_000);

const svcStatus = async (id: string) =>
  (await svc.from('visits').select('status, ref_number, created_at, checked_in_at, rejection_reason').eq('id', id).single()).data!;

// ─────────────────────────────────────────────────────────────────────────────

describe('S9/SEC-5: role enforcement — staff', () => {
  it('staff CANNOT approve a visit (RPC rejected, direct update touches 0 rows)', async () => {
    const { error } = await staff.rpc('approve_visit', { visit_id: vHrPending });
    expect(error).not.toBeNull();
    expect(error!.message).toMatch(/Only HOD or Admin/i);

    await staff.from('visits').update({ status: 'approved' }).eq('id', vHrPending);
    expect((await svcStatus(vHrPending)).status).toBe('pending_approval'); // unchanged
  }, 30_000);

  it('staff CANNOT read pending approvals of another department', async () => {
    const { data } = await staff.from('visits').select('id').eq('department_id', itDept);
    expect(data ?? []).toHaveLength(0); // staff is HR — zero IT rows visible

    const { data: own } = await staff.from('visits').select('id').eq('id', vHrPending);
    expect(own).toHaveLength(1); // sanity: own-department rows ARE visible
  }, 30_000);

  it('staff CAN create a gate pass request for their own department only', async () => {
    const { data: ok, error: okErr } = await staff.from('gate_passes')
      .insert({ type: 'NRGP', direction: 'IN', department_id: hrDept, reason: 'rls test — own dept', created_by: staffId })
      .select('id').single();
    expect(okErr).toBeNull();
    cleanupPasses.push(ok!.id);

    const { error: denyErr } = await staff.from('gate_passes')
      .insert({ type: 'NRGP', direction: 'IN', department_id: itDept, reason: 'rls test — other dept', created_by: staffId })
      .select('id').single();
    expect(denyErr).not.toBeNull(); // RLS blocks cross-department insert
  }, 30_000);
});

describe('S9/SEC-5: role enforcement — guard', () => {
  it('guard CANNOT edit check-in/check-out timestamps (server clock wins, SEC-3)', async () => {
    await guard.from('visits').update({ checked_in_at: '2020-01-01T00:00:00Z' }).eq('id', vCheckedIn);
    const after = await svcStatus(vCheckedIn);
    const ageMs = Date.now() - new Date(after.checked_in_at!).getTime();
    expect(new Date(after.checked_in_at!).getFullYear()).toBeGreaterThanOrEqual(new Date().getFullYear());
    expect(Math.abs(ageMs)).toBeLessThan(60_000); // forced to now(), not 2020
  }, 30_000);

  it('guard CANNOT approve or reject a visit', async () => {
    const { error } = await guard.from('visits').update({ status: 'approved' }).eq('id', vDeny);
    expect(error).not.toBeNull();
    expect(error!.message).toMatch(/Only HOD or Admin/i);
    expect((await svcStatus(vDeny)).status).toBe('pending_approval');
  }, 30_000);

  it('guard CAN register a visitor and log an exit', async () => {
    const { data: v, error: vErr } = await guard.from('visitors')
      .upsert({ phone: '9998887772', full_name: 'Guard Flow Visitor' }, { onConflict: 'phone' }).select().single();
    expect(vErr).toBeNull();

    const { data: visit, error: iErr } = await guard.from('visits')
      .insert({ visitor_id: v!.id, department_id: itDept, host_id: hodItId, purpose: 'delivery', carrying_material: false })
      .select('id, ref_number, status').single();
    expect(iErr).toBeNull();
    cleanupVisits.push(visit!.id);
    expect(visit!.ref_number).toMatch(REF_RE);
    expect(visit!.status).toBe('pending_approval');

    await svc.from('visits').update({ status: 'approved' }).eq('id', visit!.id); // HOD step, simulated server-side
    const { error: inErr } = await guard.from('visits')
      .update({ status: 'checked_in', checked_in_at: new Date().toISOString() }).eq('id', visit!.id);
    expect(inErr).toBeNull();
    const { error: outErr } = await guard.from('visits')
      .update({ status: 'checked_out', checked_out_at: new Date().toISOString(), exit_verified: true }).eq('id', visit!.id);
    expect(outErr).toBeNull();
    expect((await svcStatus(visit!.id)).status).toBe('checked_out');

    await svc.from('visitors').delete().eq('id', v!.id).then(() => undefined, () => undefined);
  }, 30_000);
});

describe('S9/SEC-5: role enforcement — HOD', () => {
  it("HOD CANNOT approve another department's visit", async () => {
    const { error } = await hodFIN.rpc('approve_visit', { visit_id: vDeny }); // vDeny is IT
    expect(error).not.toBeNull();
    expect(error!.message).toMatch(/own department/i);
    expect((await svcStatus(vDeny)).status).toBe('pending_approval');
  }, 30_000);

  it('HOD CAN approve/reject visits for their own department', async () => {
    const { error: aErr } = await hodIT.rpc('approve_visit', { visit_id: vApprove });
    expect(aErr).toBeNull();
    expect((await svcStatus(vApprove)).status).toBe('approved');

    const { error: rErr } = await hodIT.rpc('reject_visit', { visit_id: vReject, reason: 'RLS test rejection' });
    expect(rErr).toBeNull();
    const rejected = await svcStatus(vReject);
    expect(rejected.status).toBe('rejected');
    expect(rejected.rejection_reason).toBe('RLS test rejection');
  }, 30_000);

  // Delegation/escalation is Milestone B scope (S2b, FR-VIS-07) — converts with that feature.
  it.todo("delegate receives approval rights ONLY for their HOD's department");

  it('user CANNOT escalate privileges by editing their own user_metadata (migration 010)', async () => {
    // A staff user forges role/department in user_metadata (which auth.updateUser allows)…
    const { error: upErr } = await staff.auth.updateUser({ data: { role: 'admin', department_id: itDept } });
    expect(upErr).toBeNull();
    await staff.auth.refreshSession(); // new JWT now carries the forged user_metadata

    // …but enforcement reads app_metadata, so the forgery changes nothing:
    const { error } = await staff.rpc('approve_visit', { visit_id: vDeny });
    expect(error).not.toBeNull();
    expect(error!.message).toMatch(/Only HOD or Admin/i);
    expect((await svcStatus(vDeny)).status).toBe('pending_approval');

    const { data: leaked } = await staff.from('visits').select('id').eq('department_id', itDept);
    expect(leaked ?? []).toHaveLength(0); // still cannot read IT department visits

    await staff.auth.updateUser({ data: { role: null, department_id: null } }); // tidy up
  }, 30_000);
});

describe('S9/SEC-3: server-authoritative data', () => {
  it('client-supplied reference numbers are ignored/rejected', async () => {
    const { data: visit, error } = await guard.from('visits')
      .insert({
        visitor_id: visitorId, department_id: itDept, host_id: hodItId, purpose: 'other',
        carrying_material: false, ref_number: 'HACK-0001',
      } as never)
      .select('id, ref_number').single();
    expect(error).toBeNull();
    cleanupVisits.push(visit!.id);
    expect(visit!.ref_number).toMatch(REF_RE); // trigger overwrote the client value
    expect(visit!.ref_number).not.toBe('HACK-0001');

    await guard.from('visits').update({ ref_number: 'HACK-0002' } as never).eq('id', visit!.id);
    expect((await svcStatus(visit!.id)).ref_number).toMatch(REF_RE); // immutable on update too
  }, 30_000);

  it('client-supplied timestamps are ignored/rejected', async () => {
    const { data: visit, error } = await guard.from('visits')
      .insert({
        visitor_id: visitorId, department_id: itDept, host_id: hodItId, purpose: 'other',
        carrying_material: false, created_at: '2020-01-01T00:00:00Z',
      } as never)
      .select('id, created_at').single();
    expect(error).toBeNull();
    cleanupVisits.push(visit!.id);
    expect(new Date(visit!.created_at).getFullYear()).toBeGreaterThan(2020); // server now()

    await guard.from('visits').update({ created_at: '2020-01-01T00:00:00Z' } as never).eq('id', visit!.id);
    expect(new Date((await svcStatus(visit!.id)).created_at).getFullYear()).toBeGreaterThan(2020);
  }, 30_000);

  it('status transitions violating the state machine are rejected server-side', async () => {
    // approved → checked_out (skipping check-in)
    const { error: skipErr } = await guard.from('visits').update({ status: 'checked_out' }).eq('id', vApproved);
    expect(skipErr).not.toBeNull();
    expect(skipErr!.message).toMatch(/Invalid status transition/i);

    // checked_in → approved (reversal)
    const { error: revErr } = await guard.from('visits').update({ status: 'approved' }).eq('id', vCheckedIn);
    expect(revErr).not.toBeNull();
    expect(revErr!.message).toMatch(/Invalid status transition|Only HOD or Admin/i);
  }, 30_000);
});

describe('S10/SEC-2: photo privacy (FR-CAM-13)', () => {
  it('unauthenticated fetch of a photo URL returns an error (bucket is private)', async () => {
    const res = await fetch(`${URL}/storage/v1/object/public/visitor-photos/${PROBE_PATH}`);
    expect(res.status).not.toBe(200); // 400/403/404 — anything but success
  }, 30_000);

  it('photo access works only via short-lived signed URLs for authorized roles', async () => {
    const { data, error } = await guard.storage.from('visitor-photos').createSignedUrl(PROBE_PATH, 60);
    expect(error).toBeNull();
    const res = await fetch(data!.signedUrl);
    expect(res.status).toBe(200);
  }, 30_000);

  it('anon key CANNOT list the photos bucket', async () => {
    const { data, error } = await anon.storage.from('visitor-photos').list('rls-probe');
    // Either an explicit error or an empty result — never the object listing.
    if (error === null) expect(data ?? []).toHaveLength(0);
    else expect(error).not.toBeNull();
  }, 30_000);
});

describe('SEC-1: RLS coverage', () => {
  const TABLES = ['departments', 'profiles', 'visitors', 'visits', 'gate_passes', 'gate_pass_items', 'notifications'];

  it('no table is readable by the anon role (every policy is to authenticated)', async () => {
    for (const t of TABLES) {
      const { data, error } = await anon.from(t).select('*').limit(1);
      if (error === null) expect(data ?? [], `table ${t} leaked rows to anon`).toHaveLength(0);
    }
  }, 60_000);

  it('anon role cannot write to any table (RLS enabled everywhere)', async () => {
    const { error: e1 } = await anon.from('visitors').insert({ phone: '0000000000', full_name: 'anon hack' });
    expect(e1).not.toBeNull();
    const { error: e2 } = await anon.from('departments').insert({ name: 'anon dept', code: 'ANON' });
    expect(e2).not.toBeNull();
    const { error: e3 } = await anon.from('visits').update({ status: 'approved' }).eq('department_id', itDept);
    // update with no visible rows: either error or silently 0 rows — verify nothing changed
    if (e3 === null) {
      const { data } = await svc.from('visits').select('id').eq('id', vDeny).eq('status', 'pending_approval');
      expect(data).toHaveLength(1);
    }
  }, 60_000);
});
