-- Add 'cancelled' to the visit_status enum so HODs can cancel pre-approvals
ALTER TYPE public.visit_status ADD VALUE IF NOT EXISTS 'cancelled';
