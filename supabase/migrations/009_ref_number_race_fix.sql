-- 009 — Fix ref-number generation race: concurrent inserts computed the same
-- max+1 and collided on the unique constraint "visits_ref_number_key"
-- (found by tests/security/rls.test.ts inserting fixtures in parallel; would
-- also hit two guards at two gates inserting simultaneously).
-- Serialize with an advisory transaction lock per table+day.

create or replace function public.generate_visit_ref()
returns trigger language plpgsql security definer as $$
declare
  date_str text := to_char(now() at time zone 'UTC', 'YYYYMMDD');
  seq_val  int;
begin
  perform pg_advisory_xact_lock(hashtext('visit_ref_' || date_str));
  select coalesce(max(right(ref_number, -length(split_part(ref_number,'-',1))-length(split_part(ref_number,'-',2))-2)::int),0)
  into seq_val
  from public.visits
  where ref_number like 'VIS-' || date_str || '-%';

  new.ref_number := 'VIS-' || date_str || '-' || lpad((seq_val + 1)::text, 4, '0');
  new.created_at := now();
  return new;
end;
$$;

create or replace function public.generate_gate_pass_ref()
returns trigger language plpgsql security definer as $$
declare
  date_str text := to_char(now() at time zone 'UTC', 'YYYYMMDD');
  prefix   text;
  seq_val  int;
begin
  prefix := 'GP-' || new.direction || '-' || date_str;
  perform pg_advisory_xact_lock(hashtext('gp_ref_' || new.direction || date_str));
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
