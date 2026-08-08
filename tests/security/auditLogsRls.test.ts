// CHECK for goal.md S9 (🎯, SECURITY BASELINE SEC-5) — FR ref: NFR-04, FR-CAM-13
//
// These are RLS COVERAGE tests for public.audit_logs: they assert a non-admin
// authenticated user can read an audit_logs row IFF they can already see the
// underlying visits row (own department, or guard sees all), and cannot read
// rows belonging to another department. They run against the live Supabase
// project in .env, using the seeded demo users (scripts/seed.ts, password
// demo123). Fixtures are created via the service-role client in beforeAll and
// removed in afterAll — this file owns its fixtures independently, since
// vi/beforeAll state cannot be shared across test files (see rls.test.ts).
//
// Since migration 063 the client can no longer INSERT into audit_logs at all
// (the permissive "triggers can insert" policy + INSERT grant are gone — every
// writer is a SECURITY DEFINER trigger, so no client grant is needed). The
// file therefore also proves the two halves of that fix: a forged insert is
// refused, and a real visit-approval still leaves its audit row behind.
//
// Enforcement under test:
//   043_department_scoped_rls_audit.sql — "audit_logs: read via visit access"
//   (sits alongside the pre-existing admin-only policy from migration 041;
//   this file does not re-test the admin path, only the visit-scoped one)
//   063_audit_logs_no_client_insert.sql — forgery closure
import 'dotenv/config';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const URL = process.env.VITE_SUPABASE_URL!;
const ANON = process.env.VITE_SUPABASE_ANON_KEY!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const PASS = 'demo123';

if (!URL || !ANON || !SERVICE) {
  throw new Error('auditLogsRls.test.ts requires VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY in .env');
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
//
// NOTE: hod.fin@demo.vms is the Finance (FIN) department head, NOT HR
// (scripts/seed.ts: 'hod_fin' -> dept['FIN'], 'hod_hr' -> dept['HR']). The HR
// department head is hod.hr@demo.vms. Using hodFIN against an HR-department
// visit fails RLS since its JWT department_id is FIN's, not HR's — so this
// file logs in the real HR head instead of reusing the "hodFIN" name/email
// from rls.test.ts (which never actually exercises an HR-department fixture).
let guard: SupabaseClient, hodIT: SupabaseClient, hodHR: SupabaseClient;
let itDept = '', hrDept = '';
let hodItId = '';
let visitorId = '';
let itVisitId = '', hrVisitId = '';
let itLogId = '', hrLogId = '';

beforeAll(async () => {
  [guard, hodIT, hodHR] = await Promise.all([
    login('guard@demo.vms'), login('hod.it@demo.vms'), login('hod.hr@demo.vms'),
  ]);

  const { data: depts } = await svc.from('departments').select('id, code').in('code', ['IT', 'HR']);
  itDept = depts!.find((d) => d.code === 'IT')!.id;
  hrDept = depts!.find((d) => d.code === 'HR')!.id;

  const { data: profs } = await svc.from('profiles').select('id, email').eq('email', 'hod.it@demo.vms');
  hodItId = profs!.find((p) => p.email === 'hod.it@demo.vms')!.id;

  const { data: vis, error: visErr } = await svc.from('visitors')
    .upsert({ phone: '9998887773', full_name: 'Audit Logs RLS Test Visitor', vendor_name: 'TestCo' }, { onConflict: 'phone' })
    .select().single();
  if (visErr) throw visErr;
  visitorId = vis!.id;

  // Sequential inserts: the ref-number trigger computes max+1 by reading the
  // table, so parallel inserts race into duplicate refs (memory.md SB-03).
  async function mkVisit(dept: string): Promise<string> {
    const { data, error } = await svc.from('visits')
      .insert({ visitor_id: visitorId, department_id: dept, host_id: hodItId, purpose: 'meeting', carrying_material: false, status: 'pending_approval' })
      .select('id').single();
    if (error) throw error;
    return data!.id;
  }
  itVisitId = await mkVisit(itDept);
  hrVisitId = await mkVisit(hrDept);

  // Insert audit_logs rows directly via service role (bypasses RLS and the trigger).
  const { data: itLog, error: itLogErr } = await svc.from('audit_logs')
    .insert({ entity_type: 'visit', entity_id: itVisitId, action: 'visit_approved', user_id: hodItId })
    .select('id').single();
  if (itLogErr) throw itLogErr;
  itLogId = itLog!.id;

  const { data: hrLog, error: hrLogErr } = await svc.from('audit_logs')
    .insert({ entity_type: 'visit', entity_id: hrVisitId, action: 'visit_rejected', user_id: null })
    .select('id').single();
  if (hrLogErr) throw hrLogErr;
  hrLogId = hrLog!.id;
}, 120_000);

afterAll(async () => {
  const logIds = [itLogId, hrLogId].filter(Boolean);
  if (logIds.length) await svc.from('audit_logs').delete().in('id', logIds);
  const visitIds = [itVisitId, hrVisitId].filter(Boolean);
  if (visitIds.length) {
    await svc.from('notifications').delete().in('related_id', visitIds);
    await svc.from('visits').delete().in('id', visitIds);
  }
  if (visitorId) await svc.from('visitors').delete().eq('id', visitorId).then(() => undefined, () => undefined);
  await Promise.all([guard, hodIT, hodHR].map((c) => c?.auth.signOut()));
}, 60_000);

// ─────────────────────────────────────────────────────────────────────────────

describe('S9/SEC-5: audit_logs RLS — read scoped by visit access (migration 043)', () => {
  it('IT HOD CAN read the audit_logs row for the IT visit', async () => {
    const { data, error } = await hodIT.from('audit_logs').select('*').eq('entity_id', itVisitId);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  }, 30_000);

  it('IT HOD CANNOT read the audit_logs row for the HR visit', async () => {
    const { data, error } = await hodIT.from('audit_logs').select('*').eq('entity_id', hrVisitId);
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);
  }, 30_000);

  it('HR HOD CAN read the audit_logs row for the HR visit', async () => {
    const { data, error } = await hodHR.from('audit_logs').select('*').eq('entity_id', hrVisitId);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  }, 30_000);

  it('HR HOD CANNOT read the audit_logs row for the IT visit', async () => {
    const { data, error } = await hodHR.from('audit_logs').select('*').eq('entity_id', itVisitId);
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);
  }, 30_000);

  it('guard CAN read both audit_logs rows (guard sees all visits)', async () => {
    const { data: itData, error: itErr } = await guard.from('audit_logs').select('*').eq('entity_id', itVisitId);
    expect(itErr).toBeNull();
    expect(itData).toHaveLength(1);

    const { data: hrData, error: hrErr } = await guard.from('audit_logs').select('*').eq('entity_id', hrVisitId);
    expect(hrErr).toBeNull();
    expect(hrData).toHaveLength(1);
  }, 30_000);

  it('a non-admin user CANNOT insert an audit_logs row (forgery closed, migration 063)', async () => {
    // With "audit_logs: triggers can insert" (with check (true)) + a client
    // INSERT grant, any signed-in user could fabricate trail rows — arbitrary
    // actor, action and even created_at. That policy and grant are gone; this
    // is the behavioural proof the forgery vector is closed.
    const { error } = await hodIT.from('audit_logs').insert({
      entity_type: 'visit',
      entity_id: itVisitId,
      action: 'visit_approved',
      user_id: hodItId,
      details: { forged: true },
    });
    expect(error).not.toBeNull();

    // And the attempted forgery is nowhere in the trail.
    const { data } = await svc.from('audit_logs').select('id').eq('details', { forged: true } as Record<string, boolean>);
    expect(data ?? []).toHaveLength(0);
  }, 30_000);

  it('approving a visit still writes its audit row (SECURITY DEFINER trigger unaffected by the revoke)', async () => {
    // The audit writers are SECURITY DEFINER triggers owned by the table
    // owner, so they never depended on the client grant — revoking it must not
    // have silenced the trail. Approve the IT fixture via the same RPC the app
    // uses and expect the trigger to add a row. (beforeAll already planted one
    // visit_approved fixture row for this visit, so assert on the DELTA.)
    const before = (await svc.from('audit_logs').select('id')
      .eq('entity_type', 'visit').eq('entity_id', itVisitId).eq('action', 'visit_approved')).data ?? [];

    const { error: aErr } = await hodIT.rpc('approve_visit', { visit_id: itVisitId });
    expect(aErr).toBeNull();

    const { data, error } = await svc.from('audit_logs').select('id, action, user_id, created_at')
      .eq('entity_type', 'visit').eq('entity_id', itVisitId).eq('action', 'visit_approved')
      .order('created_at', { ascending: true });
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(before.length + 1);
    expect(data![data!.length - 1].user_id).toBe(hodItId);
  }, 30_000);
});
