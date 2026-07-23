alter table public.gate_passes
  add column if not exists company_name text;

notify pgrst, 'reload schema';

