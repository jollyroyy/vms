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
  company: string | null;
  id_type: string | null;
  id_last4: string | null;
  vehicle_number: string | null;
  is_blacklisted: boolean;
  blacklist_reason: string | null;
  created_at: string;
};

export type VisitStatus = 'pending_approval' | 'approved' | 'walkin_approved' | 'checked_in' | 'checked_out' | 'rejected' | 'cancelled' | 'no_show';

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
  expected_duration_minutes: number | null;
  scheduled_for: string | null;
  grace_period_minutes?: number;
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
  user_id: string;
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
  visitor_company: string | null;
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
          company?: string | null;
          id_type?: string | null;
          id_last4?: string | null;
          vehicle_number?: string | null;
          is_blacklisted?: boolean;
          blacklist_reason?: string | null;
        };
        Update: Partial<Visitor>;
        Relationships: [];
      };
      visits:         { Row: Visit;         Insert: Omit<Visit, 'id' | 'ref_number' | 'created_at' | 'visitor' | 'department' | 'host' | 'photo_url'>; Update: Partial<Visit>; Relationships: [] };
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
