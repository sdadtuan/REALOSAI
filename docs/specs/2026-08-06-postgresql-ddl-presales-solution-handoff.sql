-- P3-S1 — Sales → Solution/MKT handoff columns on crm_lead_presales
-- Apply: scripts/apply_pg_ddl_presales_solution_handoff.sh

ALTER TABLE crm_lead_presales
    ADD COLUMN IF NOT EXISTS handoff_status TEXT NOT NULL DEFAULT '';

ALTER TABLE crm_lead_presales
    ADD COLUMN IF NOT EXISTS handed_off_at TIMESTAMPTZ;

ALTER TABLE crm_lead_presales
    ADD COLUMN IF NOT EXISTS handed_off_by_staff_id BIGINT;

ALTER TABLE crm_lead_presales
    ADD COLUMN IF NOT EXISTS solution_owner_staff_id BIGINT;

ALTER TABLE crm_lead_presales
    ADD COLUMN IF NOT EXISTS solution_claimed_at TIMESTAMPTZ;

ALTER TABLE crm_lead_presales
    ADD COLUMN IF NOT EXISTS solution_released_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_crm_lead_presales_handoff_status
    ON crm_lead_presales (handoff_status)
    WHERE handoff_status IN ('pending', 'with_solution');

-- P2 SLA timestamps (required for legacy backfill + metrics on PG)
ALTER TABLE crm_lead_presales
    ADD COLUMN IF NOT EXISTS consult_entered_at TIMESTAMPTZ;

ALTER TABLE crm_lead_presales
    ADD COLUMN IF NOT EXISTS proposal_entered_at TIMESTAMPTZ;

-- Legacy consult leads → Solution queue (idempotent)
UPDATE crm_lead_presales
SET handoff_status = 'with_solution',
    handed_off_at = COALESCE(handed_off_at, consult_entered_at, stage_entered_at, NOW()),
    consult_entered_at = COALESCE(consult_entered_at, stage_entered_at, NOW())
WHERE stage = 'consult'
  AND status = 'active'
  AND (handoff_status = '' OR handoff_status IS NULL);
