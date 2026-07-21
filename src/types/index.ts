// Shared TypeScript types — mirrors the Supabase schema (supabase/migrations/001_schema.sql).
// Keep in sync whenever the schema changes.

export type UserRole = 'guard' | 'hod' | 'staff' | 'admin' | 'super_admin';

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

export type VisitStatus = 'pending_approval' | 'approved' | 'walkin_approved' | 'checked_in' | 'checked_out' | 'rejected';

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
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  expected_duration_minutes: number | null;
  consent_privacy: boolean;
  consent_site_rules: boolean;
  nda_signature: string | null;
  privacy_signature: string | null;
  site_rules_signature: string | null;
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
  expected_return_date: string | null;
  created_by: string;
  created_at: string;
  // joined
  items?: GatePassItem[];
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
      notifications:  { Row: Notification;  Insert: Omit<Notification, 'id' | 'created_at'>;   Update: Partial<Notification>;  Relationships: [] };
    };
    Views:     Record<string, never>;
    Functions: Record<string, never>;
    Enums:     Record<string, never>;
  };
};
