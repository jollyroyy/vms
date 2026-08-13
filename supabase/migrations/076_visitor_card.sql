-- 076 — the visitor card.
--
-- A physical card with a printed number is handed to a visitor at check-in and
-- must come back at check-out. The NUMBER is guard-typed free text — the mall
-- offices own the physical inventory, and a cards table would try to keep
-- paper in sync with software for no gate benefit. `visitor_card_returned_at`
-- records the moment a guard confirmed the card was collected at the gate; it
-- answers "did the card come back", which is a different question from
-- `checked_out_at` ("did the visitor leave").
--
-- The card is REQUIRED to complete a check-in in the app (guard paths only:
-- CheckInPhotoStep and GuardWalkInApproved). There is deliberately NO
-- `status = 'checked_in' -> card not null` CHECK here: the kiosk is a
-- self-service check-in with no guard to hand over a card, and it writes
-- `checked_in` directly. A DB rule the kiosk would break is worse than a
-- client rule the guard enforces.

ALTER TABLE public.visits ADD COLUMN IF NOT EXISTS visitor_card_number text;
ALTER TABLE public.visits ADD COLUMN IF NOT EXISTS visitor_card_returned_at timestamptz;

-- Card numbers are short structured identifiers (codes like C-104), mirroring
-- the input allowlist pattern of migration 062 — the client checks the same
-- regex before the write.
ALTER TABLE public.visits DROP CONSTRAINT IF EXISTS visits_card_number_format;
ALTER TABLE public.visits ADD CONSTRAINT visits_card_number_format
  CHECK (visitor_card_number IS NULL OR visitor_card_number ~ '^[A-Za-z0-9-]{1,20}$');

-- A card can only be returned if one was issued, and only when the visit
-- actually closed. This also keeps the undo path (074) honest: undoing a
-- check-out must clear `visitor_card_returned_at` too, or the row claims a
-- card was collected from a visitor who is back inside.
ALTER TABLE public.visits DROP CONSTRAINT IF EXISTS visits_card_returned_consistency;
ALTER TABLE public.visits ADD CONSTRAINT visits_card_returned_consistency
  CHECK (visitor_card_returned_at IS NULL
         OR (visitor_card_number IS NOT NULL AND status = 'checked_out'));