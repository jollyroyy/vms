-- 069 — `visit_overdue` joins notification_type.
--
-- Its own migration for the same reason as 065: Postgres will not let a new enum
-- value be used in the transaction that adds it. 070 is the first writer.

alter type public.notification_type add value if not exists 'visit_overdue';
