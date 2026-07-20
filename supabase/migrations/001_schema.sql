-- VMS Database Schema — Milestone A
-- Run in Supabase SQL Editor or via `supabase db push`.
-- Every table gets RLS enabled immediately (SEC-1 — never create without policies).

-- ─── Extensions ──────────────────────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ─── Departments ─────────────────────────────────────────────────────────────
create table public.departments (
  id         uuid primary key default uuid_generate_v4(),
  name       text not null,
  code       text not null unique,
  created_at timestamptz not null default now()
);
alter table public.departments enable row level security;

-- ─── Profiles (extends auth.users) ──────────────────────────────────────────
create type public.user_role as enum ('guard','hod','staff','admin','super_admin');

create table public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         text not null,
  full_name     text not null,
  role          public.user_role not null default 'staff',
  department_id uuid references public.departments(id),
  delegate_id   uuid references public.profiles(id),
  created_at    timestamptz not null default now()
);
alter table public.profiles enable row level security;

-- Auto-create profile on sign-up and sync role to JWT metadata
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)));
  -- Sync role to auth.users metadata so JWT-based RLS policies work
  update auth.users
  set raw_user_meta_data = raw_user_meta_data || jsonb_build_object('role', 'staff')
  where id = new.id;
  return new;
end;
$$;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─── Visitors (keyed on normalized phone) ────────────────────────────────────
create table public.visitors (
  id                uuid primary key default uuid_generate_v4(),
  phone             text not null unique, -- normalized (src/lib/blacklist.ts format)
  full_name         text not null,
  company           text,
  id_type           text,
  id_last4          text, -- max 4 chars, never full govt ID (NFR-05)
  is_blacklisted    boolean not null default false,
  blacklist_reason  text,
  created_at        timestamptz not null default now()
);
alter table public.visitors enable row level security;

-- ─── Visits ──────────────────────────────────────────────────────────────────
create type public.visit_status as enum (
  'pending_approval','approved','checked_in','checked_out','rejected'
);
create type public.visitor_purpose as enum (
  'meeting','vendor','interview','delivery','maintenance','audit','other'
);

create table public.visits (
  id                uuid primary key default uuid_generate_v4(),
  ref_number        text not null unique,   -- set by trigger below (NFR-07 / SEC-3)
  visitor_id        uuid not null references public.visitors(id),
  department_id     uuid not null references public.departments(id),
  host_id           uuid not null references public.profiles(id),
  purpose           public.visitor_purpose not null,
  photo_path        text,                   -- path in private storage bucket (SEC-2)
  status            public.visit_status not null default 'pending_approval',
  checked_in_at     timestamptz,            -- guard logs entry (NFR-07)
  checked_out_at    timestamptz,            -- guard logs exit
  exit_verified     boolean,               -- false = auto-closed at day end (FR-VIS-08)
  rejection_reason  text,
  carrying_material boolean not null default false,
  created_at        timestamptz not null default now()
);
alter table public.visits enable row level security;

-- Daily-resetting ref number sequence (SEC-3 / NFR-07)
create sequence if not exists public.visit_seq_daily;

create or replace function public.generate_visit_ref()
returns trigger language plpgsql security definer as $$
declare
  date_str text := to_char(now() at time zone 'UTC', 'YYYYMMDD');
  seq_val  int;
begin
  -- Reset seq if new day (compare with last ref)
  select coalesce(max(right(ref_number, -length(split_part(ref_number,'-',1))-length(split_part(ref_number,'-',2))-2)::int),0)
  into seq_val
  from public.visits
  where ref_number like 'VIS-' || date_str || '-%';

  new.ref_number := 'VIS-' || date_str || '-' || lpad((seq_val + 1)::text, 4, '0');
  new.created_at := now();  -- enforce server timestamp (NFR-07)
  return new;
end;
$$;
create trigger set_visit_ref
  before insert on public.visits
  for each row execute function public.generate_visit_ref();

-- ─── Gate Passes ─────────────────────────────────────────────────────────────
create type public.gate_pass_type      as enum ('RGP','NRGP');
create type public.gate_pass_direction as enum ('IN','OUT');
create type public.gate_pass_status    as enum (
  'draft','pending_approval','approved','dispatched',
  'awaiting_return','partially_returned','returned','closed','rejected','cancelled'
);

create table public.gate_passes (
  id                   uuid primary key default uuid_generate_v4(),
  ref_number           text not null unique,
  type                 public.gate_pass_type      not null,
  direction            public.gate_pass_direction not null,
  visit_id             uuid references public.visits(id),
  department_id        uuid not null references public.departments(id),
  status               public.gate_pass_status    not null default 'draft',
  reason               text not null,
  carrier_name         text,
  expected_return_date date,
  created_by           uuid not null references public.profiles(id),
  created_at           timestamptz not null default now()
);
alter table public.gate_passes enable row level security;

create or replace function public.generate_gate_pass_ref()
returns trigger language plpgsql security definer as $$
declare
  date_str text := to_char(now() at time zone 'UTC', 'YYYYMMDD');
  prefix   text;
  seq_val  int;
begin
  prefix := 'GP-' || new.direction || '-' || date_str;
  select coalesce(max(right(ref_number,
    length(ref_number) - length(prefix) - 1)::int), 0)
  into seq_val
  from public.gate_passes
  where ref_number like prefix || '-%';

  new.ref_number := prefix || '-' || lpad((seq_val + 1)::text, 4, '0');
  new.created_at := now();
  return new;
end;
$$;
create trigger set_gate_pass_ref
  before insert on public.gate_passes
  for each row execute function public.generate_gate_pass_ref();

-- ─── Gate Pass Items ─────────────────────────────────────────────────────────
create table public.gate_pass_items (
  id            uuid primary key default uuid_generate_v4(),
  gate_pass_id  uuid not null references public.gate_passes(id) on delete cascade,
  description   text not null,
  qty           int  not null check (qty > 0),
  unit          text,
  serial_no     text,
  approx_value  numeric(12,2),
  returned_qty  int  not null default 0 check (returned_qty >= 0)
);
alter table public.gate_pass_items enable row level security;

-- ─── Notifications ───────────────────────────────────────────────────────────
create type public.notification_type as enum (
  'visit_pending_approval','visit_approved','visit_rejected','visitor_checked_in',
  'gate_pass_pending','gate_pass_approved','rgp_due_soon','rgp_overdue'
);

create table public.notifications (
  id           uuid primary key default uuid_generate_v4(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  type         public.notification_type not null,
  title        text not null,
  body         text not null,
  related_id   uuid,
  is_read      boolean not null default false,
  created_at   timestamptz not null default now()
);
alter table public.notifications enable row level security;

-- Trigger: notify HOD when a visit is created (FR-NOT-01 / S13a)
create or replace function public.notify_hod_on_visit()
returns trigger language plpgsql security definer as $$
declare
  hod_id  uuid;
  dept_nm text;
  vis_nm  text;
begin
  select p.id into hod_id
  from public.profiles p
  where p.department_id = new.department_id and p.role = 'hod'
  limit 1;

  select name into dept_nm from public.departments where id = new.department_id;
  select full_name into vis_nm from public.visitors where id = new.visitor_id;

  if hod_id is not null then
    insert into public.notifications (recipient_id, type, title, body, related_id)
    values (
      hod_id,
      'visit_pending_approval',
      'Visitor approval needed — ' || dept_nm,
      vis_nm || ' is at the gate waiting for your approval. Ref: ' || new.ref_number,
      new.id
    );
  end if;
  return new;
end;
$$;
create trigger notify_hod_on_new_visit
  after insert on public.visits
  for each row when (new.status = 'pending_approval')
  execute function public.notify_hod_on_visit();

-- Trigger: notify guard on approval/rejection (FR-NOT-02 / S13a)
create or replace function public.notify_guard_on_decision()
returns trigger language plpgsql security definer as $$
declare
  guard_id uuid;
begin
  if new.status not in ('approved','rejected') then return new; end if;
  if old.status = new.status then return new; end if;

  -- Notify all guards (in production scope to the gate/shift)
  for guard_id in select id from public.profiles where role = 'guard' loop
    insert into public.notifications (recipient_id, type, title, body, related_id)
    values (
      guard_id,
      case when new.status = 'approved' then 'visit_approved'::public.notification_type
           else 'visit_rejected'::public.notification_type end,
      case when new.status = 'approved' then '✓ Visitor approved — ' || new.ref_number
           else '✗ Visitor rejected — ' || new.ref_number end,
      case when new.status = 'approved' then 'Visitor may be allowed in. Print badge.'
           else 'Reason: ' || coalesce(new.rejection_reason, '—') end,
      new.id
    );
  end loop;
  return new;
end;
$$;
create trigger notify_guard_on_visit_decision
  after update on public.visits
  for each row execute function public.notify_guard_on_decision();
