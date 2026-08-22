-- Pack BĐS P9 — Apply: scripts/apply_pg_ddl_bds_p9.sh
BEGIN;

ALTER TABLE bds_transactions
  ADD COLUMN IF NOT EXISTS title_status TEXT NOT NULL DEFAULT 'not_started';

ALTER TABLE bds_transactions
  DROP CONSTRAINT IF EXISTS bds_transactions_title_status_check;

ALTER TABLE bds_transactions
  ADD CONSTRAINT bds_transactions_title_status_check
  CHECK (title_status IN ('not_started', 'submitted', 'issued', 'handed_to_buyer'));

ALTER TABLE bds_transactions
  ADD COLUMN IF NOT EXISTS handover_appointment_at TIMESTAMPTZ;

ALTER TABLE bds_transactions
  ADD COLUMN IF NOT EXISTS handover_waived_at TIMESTAMPTZ;

ALTER TABLE bds_transactions
  ADD COLUMN IF NOT EXISTS handover_waived_by INTEGER;

ALTER TABLE bds_transactions
  ADD COLUMN IF NOT EXISTS handover_waive_reason TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS bds_handover_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES bds_tenants (id),
  transaction_id UUID NOT NULL REFERENCES bds_transactions (id) ON DELETE CASCADE,
  item_code TEXT NOT NULL
    CHECK (item_code IN ('water', 'electric', 'interior', 'minutes')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'pass', 'fail')),
  note TEXT NOT NULL DEFAULT '',
  checked_by INTEGER,
  checked_at TIMESTAMPTZ,
  UNIQUE (transaction_id, item_code)
);

CREATE INDEX IF NOT EXISTS idx_bds_handover_checks_tx
  ON bds_handover_checks (transaction_id);

CREATE TABLE IF NOT EXISTS bds_aftersales_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES bds_tenants (id),
  transaction_id UUID NOT NULL REFERENCES bds_transactions (id) ON DELETE CASCADE,
  kind TEXT NOT NULL
    CHECK (kind IN ('defect', 'title', 'other')),
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'in_progress', 'done', 'cancelled')),
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  opened_by INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bds_aftersales_tickets_tx
  ON bds_aftersales_tickets (transaction_id, status);

COMMIT;
