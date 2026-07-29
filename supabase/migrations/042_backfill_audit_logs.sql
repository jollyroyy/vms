-- 042 — Backfill the activity log from history that already exists on visits.
--
-- audit_logs was created only in migration 041, so every check-in and check-out
-- before that point is missing from /admin/activity and the page opens empty.
--
-- Only events with a REAL recorded timestamp are reconstructed: visits.checked_in_at
-- and visits.checked_out_at. Approvals and rejections are deliberately NOT
-- backfilled — the visits table stores no decision timestamp, so any row written
-- here would be invented rather than recovered.
--
-- The actor is unknown for reconstructed rows (visits does not record who acted),
-- so user_id stays null and the UI shows "System". details.backfilled = true marks
-- every row so a reconstructed event is never mistaken for a live audit record.
-- Idempotent: re-running inserts nothing new.

insert into public.audit_logs (user_id, action, entity_type, entity_id, details, created_at)
select null, 'visit_checked_in', 'visit', v.id,
       jsonb_build_object('ref_number', v.ref_number, 'backfilled', true),
       v.checked_in_at
from public.visits v
where v.checked_in_at is not null
  and not exists (
    select 1 from public.audit_logs a
    where a.entity_id = v.id and a.action = 'visit_checked_in'
  );

insert into public.audit_logs (user_id, action, entity_type, entity_id, details, created_at)
select null, 'visit_checked_out', 'visit', v.id,
       jsonb_build_object('ref_number', v.ref_number, 'backfilled', true),
       v.checked_out_at
from public.visits v
where v.checked_out_at is not null
  and not exists (
    select 1 from public.audit_logs a
    where a.entity_id = v.id and a.action = 'visit_checked_out'
  );
