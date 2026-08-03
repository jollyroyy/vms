// CHECK for goal.md S9 (🎯, SECURITY BASELINE SEC-5) — FR ref: NFR-04, FR-CAM-13
//
// These are DENIAL tests: they log in as the WRONG role and assert the backend says no.
// They run against the live Supabase project in .env, using the seeded demo users
// (scripts/seed.ts, password demo123). Fixtures are created via the service-role
// client in beforeAll and removed in afterAll.
//
// This file covers role enforcement (staff / guard / HOD). Server-authoritative
// data, photo privacy and RLS coverage live in rlsDataIntegrity.test.ts — each
// file owns its own fixtures since vi/beforeAll state cannot be shared across
// test files.
//
// Enforcement under test:
//   002_rls.sql  — role policies        004 — dept→JWT sync
//   006          — JWT-based HOD scope  007 — approve/reject security-definer RPCs
import 'dotenv/config';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const URL = process.env.VITE_SUPABASE_URL!;
const ANON = process.env.VITE_SUPABASE_ANON_KEY!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const PASS = 'demo123';
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
let itDept = '', hrDept = '';
let hodItId = '', staffId = '';
let visitorId = '';
// fixture visits (all IT department): see beforeAll
let vDeny = '', vApprove = '', vReject = '', vCheckedIn = '', vHrPending = '';
let vCancel = '', vHrApproved = '';
const cleanupVisits: string[] = [];
const cleanupPasses: string[] = [];

beforeAll(async () => {
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
    .upsert({ phone: '9998887771', full_name: 'RLS Test Visitor', vendor_name: 'TestCo' }, { onConflict: 'phone' })
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
  vCheckedIn = await mkVisit(itDept, 'checked_in');
  vHrPending = await mkVisit(hrDept, 'pending_approval');
  vCancel = await mkVisit(itDept, 'approved');
  vHrApproved = await mkVisit(hrDept, 'approved');
}, 120_000);

afterAll(async () => {
  if (cleanupPasses.length) await svc.from('gate_passes').delete().in('id', cleanupPasses);
  if (cleanupVisits.length) {
    await svc.from('notifications').delete().in('related_id', cleanupVisits);
    await svc.from('visits').delete().in('id', cleanupVisits);
  }
  if (visitorId) await svc.from('visitors').delete().eq('id', visitorId).then(() => undefined, () => undefined);
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
    // approve_visit is the WALK-IN decision path (migration 014): a guard registers a
    // walk-in as 'pending_approval' and the HOD approves it to 'walkin_approved'.
    // Pre-approvals never pass through here — pre_approve_visitor_v2 inserts them
    // directly as 'approved'. The fixtures below are 'pending_approval', so the
    // correct post-condition is 'walkin_approved', not 'approved'.
    const { error: aErr } = await hodIT.rpc('approve_visit', { visit_id: vApprove });
    expect(aErr).toBeNull();
    expect((await svcStatus(vApprove)).status).toBe('walkin_approved');

    const { error: rErr } = await hodIT.rpc('reject_visit', { visit_id: vReject, reason: 'RLS test rejection' });
    expect(rErr).toBeNull();
    const rejected = await svcStatus(vReject);
    expect(rejected.status).toBe('rejected');
    expect(rejected.rejection_reason).toBe('RLS test rejection');
  }, 30_000);

  // Cancel Pre-Approval (migration 045). public.visits has NO hod UPDATE policy,
  // so a direct .update({status:'cancelled'}) matches zero rows AND returns no
  // error — the old code reported success while changing nothing. These tests
  // pin the RPC path and the silent-failure behaviour that made it necessary.
  it('HOD CAN cancel a pre-approval in their own department', async () => {
    const { error } = await hodIT.rpc('cancel_visit', { visit_id: vCancel });
    expect(error).toBeNull();
    expect((await svcStatus(vCancel)).status).toBe('cancelled');
  }, 30_000);

  it("HOD CANNOT cancel another department's pre-approval", async () => {
    const { error } = await hodFIN.rpc('cancel_visit', { visit_id: vHrApproved });
    expect(error).not.toBeNull();
    expect(error!.message).toMatch(/own department/i);
    expect((await svcStatus(vHrApproved)).status).toBe('approved');
  }, 30_000);

  it('a direct HOD update to cancelled silently touches 0 rows (why the RPC exists)', async () => {
    const { error } = await hodIT.from('visits').update({ status: 'cancelled' }).eq('id', vHrApproved);
    expect(error).toBeNull(); // no policy match => PostgREST reports success
    expect((await svcStatus(vHrApproved)).status).toBe('approved'); // but nothing changed
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
