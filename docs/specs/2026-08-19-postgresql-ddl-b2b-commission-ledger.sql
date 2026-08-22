-- B2B commission ledger (posted when contract becomes Active)
BEGIN;

CREATE TABLE IF NOT EXISTS crm_b2b_commission_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id BIGINT NOT NULL,
  contract_id BIGINT NOT NULL,
  first_touch_staff_id BIGINT,
  closer_staff_id BIGINT,
  first_touch_amt BIGINT NOT NULL DEFAULT 0,
  closer_amt BIGINT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'posted',
  posted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_b2b_commission_ledger_lead_contract UNIQUE (lead_id, contract_id)
);

CREATE INDEX IF NOT EXISTS idx_b2b_commission_ledger_lead ON crm_b2b_commission_ledger (lead_id);
CREATE INDEX IF NOT EXISTS idx_b2b_commission_ledger_posted ON crm_b2b_commission_ledger (posted_at DESC);

COMMIT;
