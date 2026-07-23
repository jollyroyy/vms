-- Prevent guards from backdating check-in or check-out timestamps.
-- Allows a 5-minute tolerance for clock skew / network latency.

CREATE OR REPLACE FUNCTION public.prevent_past_timestamps()
RETURNS trigger AS $$
BEGIN
  -- Block checked_in_at set to more than 5 minutes in the past
  IF NEW.checked_in_at IS NOT NULL
     AND (OLD.checked_in_at IS NULL OR NEW.checked_in_at <> OLD.checked_in_at)
     AND NEW.checked_in_at < (now() - interval '5 minutes')
  THEN
    RAISE EXCEPTION 'Check-in time cannot be in the past';
  END IF;

  -- Block checked_out_at set to more than 5 minutes in the past
  IF NEW.checked_out_at IS NOT NULL
     AND (OLD.checked_out_at IS NULL OR NEW.checked_out_at <> OLD.checked_out_at)
     AND NEW.checked_out_at < (now() - interval '5 minutes')
  THEN
    RAISE EXCEPTION 'Check-out time cannot be in the past';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_past_timestamps ON public.visits;

CREATE TRIGGER trg_prevent_past_timestamps
  BEFORE INSERT OR UPDATE ON public.visits
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_past_timestamps();
