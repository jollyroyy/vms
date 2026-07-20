// CHECK for goal.md S9 + S10 (🎯, SECURITY BASELINE SEC-1/2/3/5) — FR ref: NFR-04, FR-CAM-13
//
// These are DENIAL tests: they log in as the WRONG role and assert the backend says no.
// They are `it.todo` until the Supabase schema exists (loop iteration: "schema + RLS").
// The iteration that creates each table MUST convert its todos into real tests in the
// same commit (SEC-1: RLS lands with the table, not later).
//
// Implementation note: run against a local Supabase (supabase start) or a dedicated
// test project; create one authed client per role via anon key + test users from seed.
import { describe, it } from 'vitest';

describe('S9/SEC-5: role enforcement — staff', () => {
  it.todo('staff CANNOT approve a visit (RPC/update rejected by RLS)');
  it.todo('staff CANNOT read pending approvals of another department');
  it.todo('staff CAN create a gate pass request for their own department only');
});

describe('S9/SEC-5: role enforcement — guard', () => {
  it.todo('guard CANNOT edit check-in/check-out timestamps (server-generated only, SEC-3)');
  it.todo('guard CANNOT approve or reject a visit');
  it.todo('guard CAN register a visitor and log an exit');
});

describe('S9/SEC-5: role enforcement — HOD', () => {
  it.todo("HOD CANNOT approve another department's visit");
  it.todo('HOD CAN approve/reject visits for their own department');
  it.todo("delegate receives approval rights ONLY for their HOD's department");
});

describe('S9/SEC-3: server-authoritative data', () => {
  it.todo('client-supplied reference numbers are ignored/rejected');
  it.todo('client-supplied timestamps are ignored/rejected');
  it.todo('status transitions violating the state machine are rejected server-side');
});

describe('S10/SEC-2: photo privacy (FR-CAM-13)', () => {
  it.todo('unauthenticated fetch of a photo URL returns 403 (bucket is private)');
  it.todo('photo access works only via short-lived signed URLs for authorized roles');
  it.todo('anon key CANNOT list the photos bucket');
});

describe('SEC-1: RLS coverage', () => {
  it.todo('every public table has RLS enabled (query pg_tables/pg_policies)');
  it.todo('no table is readable by the anon role without a policy');
});
