-- No-show handling: auto-mark approved visitors who miss their window.

-- 1) Add status enum value
ALTER TYPE public.visit_status ADD VALUE IF NOT EXISTS 'no_show';

-- 2) Add grace_period_minutes column (per-visit, default 30 min)
ALTER TABLE public.visits
  ADD COLUMN IF NOT EXISTS grace_period_minutes integer NOT NULL DEFAULT 30;

-- 3) Function to auto-mark no-shows (called by pg_cron or edge function)
CREATE OR REPLACE FUNCTION public.mark_no_shows()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  affected integer;
BEGIN
  UPDATE public.visits
  SET status = 'no_show'
  WHERE status = 'approved'
    AND scheduled_for IS NOT NULL
    AND now() > (scheduled_for + (grace_period_minutes || ' minutes')::interval);
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

-- 4) RPC wrapper so frontend can call it (admin/service role)
GRANT EXECUTE ON FUNCTION public.mark_no_shows() TO authenticated;

-- 5) Notification trigger for no-show
CREATE OR REPLACE FUNCTION public.notify_no_show()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  hod_id uuid;
  vis_nm text;
BEGIN
  IF NEW.status = 'no_show' AND OLD.status = 'approved' THEN
    SELECT p.id INTO hod_id
    FROM public.profiles p
    WHERE p.role = 'hod' AND p.department_id = NEW.department_id
    LIMIT 1;

    SELECT full_name INTO vis_nm FROM public.visitors WHERE id = NEW.visitor_id;

    IF hod_id IS NOT NULL THEN
      INSERT INTO public.notifications (recipient_id, type, title, body, related_id)
      VALUES (
        hod_id,
        'visit_rejected',
        'No-show: ' || COALESCE(vis_nm, 'Visitor') || ' did not arrive',
        'Visit ' || NEW.ref_number || ' has been marked as no-show. You can reactivate, reschedule, or close it.',
        NEW.id
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_no_show ON public.visits;
CREATE TRIGGER trg_notify_no_show
  AFTER UPDATE ON public.visits
  FOR EACH ROW EXECUTE FUNCTION public.notify_no_show();
