// Shared TypeScript types — mirrors the Supabase schema (supabase/migrations/001_schema.sql).
// Keep in sync whenever the schema changes.

export type UserRole = 'guard' | 'hod' | 'staff' | 'admin';

export type Department = {
  id: string;
  name: string;
  code: string;
  created_at: string;
};

export type Profile = {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  department_id: string | null;
  delegate_id: string | null;
  avatar_url: string | null;
  created_at: string;
};

export type VisitorPurpose =
  | 'meeting'
  | 'vendor'
  | 'interview'
  | 'delivery'
  | 'maintenance'
  | 'audit'
  | 'other';

export type Visitor = {
  id: string;
  phone: string; // normalized (see src/lib/blacklist.ts)
  full_name: string;
  vendor_name: string | null;
  id_type: string | null;
  id_last4: string | null;
  vehicle_number: string | null;
  is_blacklisted: boolean;
  blacklist_reason: string | null;
  created_at: string;
};

// `no_show`, `expired` and `lapsed` are the three "closed without arriving"
// outcomes, drawn on what actually happened — see migrations 065 and 081:
//
//   no_show — a booked slot went unused. A fact about the visitor and the host
//             who booked them, and the number a report should show.
//   expired — an approval with no slot lapsed unused. Every walk-in the host
//             cleared but who never came in, since that path never sets
//             scheduled_for.
//   lapsed  — nobody ever decided. A walk-in request raised at the gate whose
//             host never answered, closed when the day it was needed for ended.
//             It must NEVER imply an approval (visitApproval.ts,
//             visitApprover.ts): no host cleared this visitor.
export type VisitStatus = 'pending_approval' | 'approved' | 'walkin_approved' | 'checked_in' | 'checked_out' | 'rejected' | 'cancelled' | 'no_show' | 'expired' | 'lapsed';

export type Visit = {
  id: string;
  ref_number: string;
  visitor_id: string;
  department_id: string;
  host_id: string;
  purpose: VisitorPurpose;
  photo_path: string | null;
  photo_data: string | null;
  status: VisitStatus;
  checked_in_at: string | null;
  checked_out_at: string | null;
  exit_verified: boolean | null;
  rejection_reason: string | null;
  carrying_material: boolean;
  carrying_remarks?: string | null;
  // General context captured when the visit was raised. Distinct from
  // carrying_remarks, which describes material only — see migration 068.
  remarks?: string | null;
  scheduled_for: string | null;
  // When the approver expects them to leave. Null = ordinary visit, and the
  // overstay rule falls back to a fixed interval from check-in. Set = this IS
  // the deadline, which is what makes a multi-day contractor distinguishable
  // from a forgotten check-out. See migration 073.
  expected_departure?: string | null;
  // The physical visitor card handed over at check-in (guard-typed free text,
  // format-constrained — migration 076) and the moment a guard confirmed the
  // card was collected at check-out. Null card = no card on record; the kiosk
  // path never issues one.
  visitor_card_number?: string | null;
  visitor_card_returned_at?: string | null;
  grace_period_minutes?: number;
  qr_token: string;
  qr_expires_at: string | null;
  created_at: string;
  // joined fields (populated by views/RPCs)
  visitor?: Visitor;
  department?: Department;
  host?: Pick<Profile, 'id' | 'full_name'>;
  photo_url?: string;
};

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

export type NotificationType =
  | 'visit_pending_approval'
  | 'visit_approved'
  | 'visit_rejected'
  | 'visitor_checked_in'
  // Booked visitor is past their slot by the grace period and still has not
  // arrived. A message to the host and NOTHING else — the visit stays valid and
  // checkable-in all day. See migration 070.
  | 'visit_overdue'
  // The no-show workflow (migration 075): `visit_no_show` is the per-visit
  // notice fired when the sweep closes an un-arrived approval at 22:00 IST —
  // "the pass is now void, raise a new request". `visit_no_show_summary` is
  // the 20:00 IST forecast sent once per department HOD with the day's count;
  // its related_id is null because it is a summary, not a single visit.
  | 'visit_no_show'
  | 'visit_no_show_summary'
  // Historical: a guard escalated a flagged watchlist match to every admin
  // (migration 079), replacing a write into `visits.remarks`. The Watchlist
  // page was deleted 2026-08-15, so nothing new is ever inserted; the value
  // stays in the union because live rows can still exist and the bell renders
  // them generically.
  | 'watchlist_escalation'
  | 'gate_pass_pending'
  | 'gate_pass_approved'
  | 'rgp_due_soon'
  | 'rgp_overdue';

export type Notification = {
  id: string;
  recipient_id: string;
  type: NotificationType;
  title: string;
  body: string;
  related_id: string | null; // visit_id or gate_pass_id
  is_read: boolean;
  created_at: string;
};

export type AuditLog = {
  id: string;
  // Null for actions taken without a signed-in user (service role, scheduled jobs).
  user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
  // joined
  profile?: Pick<Profile, 'id' | 'full_name' | 'email'>;
};

export type RecurringVisit = {
  id: string;
  department_id: string;
  host_id: string;
  created_by: string;
  visitor_name: string;
  visitor_phone: string;
  visitor_vendor_name: string | null;
  purpose: string;
  recurrence_type: 'daily' | 'weekly' | 'monthly';
  recurrence_day: number | null;
  start_date: string;
  end_date: string | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

// Database interface consumed by the Supabase typed client.
// Each table entry must include Relationships (required by @supabase/postgrest-js GenericTable).
export type Database = {
  public: {
    Tables: {
      departments:    { Row: Department;    Insert: Omit<Department, 'id' | 'created_at'>;    Update: Partial<Department>;    Relationships: [] };
      profiles:       { Row: Profile;       Insert: Omit<Profile, 'created_at'>;               Update: Partial<Profile>;       Relationships: [] };
      // Nullable fields and fields with DB defaults are optional on insert
      visitors: {
        Row: Visitor;
        Insert: {
          phone: string;
          full_name: string;
          vendor_name?: string | null;
          id_type?: string | null;
          id_last4?: string | null;
          vehicle_number?: string | null;
          is_blacklisted?: boolean;
          blacklist_reason?: string | null;
        };
        Update: Partial<Visitor>;
        Relationships: [];
      };
      visits:         { Row: Visit;         Insert: Omit<Visit, 'id' | 'ref_number' | 'created_at' | 'qr_token' | 'qr_expires_at' | 'visitor' | 'department' | 'host' | 'photo_url'>; Update: Partial<Visit>; Relationships: [] };
      gate_passes:    { Row: GatePass;      Insert: Omit<GatePass, 'id' | 'ref_number' | 'created_at' | 'items' | 'department' | 'created_by_profile'>; Update: Partial<GatePass>; Relationships: [] };
      gate_pass_items:{ Row: GatePassItem;  Insert: Omit<GatePassItem, 'id'>;                  Update: Partial<GatePassItem>;  Relationships: [] };
      gate_signoffs:  { Row: GateSignoff;   Insert: Omit<GateSignoff, 'id' | 'created_at'>;    Update: Partial<GateSignoff>;    Relationships: [] };
      notifications:  { Row: Notification;  Insert: Omit<Notification, 'id' | 'created_at'>;   Update: Partial<Notification>;  Relationships: [] };
      audit_logs:     { Row: AuditLog;      Insert: Omit<AuditLog, 'id' | 'created_at'>;        Update: Partial<AuditLog>;      Relationships: [] };
      recurring_visits: { Row: RecurringVisit; Insert: Omit<RecurringVisit, 'id' | 'created_at' | 'updated_at'>; Update: Partial<RecurringVisit>; Relationships: [] };
    };
    Views:     Record<string, never>;
    Functions: Record<string, never>;
    Enums:     Record<string, never>;
  };
};
