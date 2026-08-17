// The material-movement module's types (RGP/NRGP gate passes).
//
// SPLIT OUT, NOT DELETED, and the distinction matters: CLAUDE.md is explicit
// that the `gate_passes` pages and routes are gone from the app but the TYPES
// and the DB tables STAY — `types/index.ts` mirrors the live schema, and the
// RLS and realtime security tests still assert on those tables. Moving them
// here keeps that promise while getting `types/index.ts` back under the
// 300-line cap, the same origin-based seam `adminTables.ts` follows. Do not
// "finish the job" by deleting this file.
//
// Re-exported from `types/index.ts`, so every existing import path still works.

import type { Department, Profile } from './index';

export type GatePassType   = 'RGP' | 'NRGP';
export type GatePassDir    = 'IN' | 'OUT';
export type GatePassStatus =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'dispatched'
  | 'awaiting_return'
  | 'partially_returned'
  | 'returned'
  | 'closed'
  | 'rejected'
  | 'cancelled';

export type GateSignoffAction = 'out' | 'in' | 'hold' | 'rejected' | 'mismatch';

export type GateSignoff = {
  id: string;
  gate_pass_id: string;
  security_user_id: string;
  security_name: string;
  security_employee_id: string | null;
  gate_name: string;
  action_type: GateSignoffAction;
  action_timestamp: string;
  verified_qty: number | null;
  verified_vehicle: string | null;
  remarks: string | null;
  photo_url: string | null;
  device_info: Record<string, unknown> | null;
  session_id: string | null;
  created_at: string;
};

export type GatePassItem = {
  id: string;
  gate_pass_id: string;
  description: string;
  qty: number;
  unit: string | null;
  serial_no: string | null;
  approx_value: number | null;
  returned_qty: number;
};

export type GatePass = {
  id: string;
  ref_number: string;
  type: GatePassType;
  direction: GatePassDir;
  visit_id: string | null;
  department_id: string;
  status: GatePassStatus;
  reason: string;
  carrier_name: string | null;
  company_name: string | null;
  verified_vehicle?: string | null;
  expected_return_date: string | null;
  created_by: string;
  created_at: string;
  // joined
  items?: GatePassItem[];
  signoffs?: GateSignoff[];
  department?: Department;
  created_by_profile?: Pick<Profile, 'id' | 'full_name'>;
};
