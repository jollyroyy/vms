-- Migration 023: Confidential visit flag (M25-CONFIDENTIAL / FR-WF-03)
-- Adds is_confidential to visits table.
-- When true: guard and staff see "Confidential visitor" only; HOD and admin see full details.

-- Add column
ALTER TABLE visits
  ADD COLUMN IF NOT EXISTS is_confidential boolean NOT NULL DEFAULT false;

-- Comment
COMMENT ON COLUMN visits.is_confidential IS
  'When true, visit details hidden from guard/staff roles — only HOD, admin, super_admin see full details.';

-- Index for filtering confidential visits
CREATE INDEX IF NOT EXISTS idx_visits_confidential ON visits(is_confidential) WHERE is_confidential = true;
