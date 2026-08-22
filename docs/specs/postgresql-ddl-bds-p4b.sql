-- Pack BĐS P4b — Apply: scripts/apply_pg_ddl_bds_p4b.sh
BEGIN;

CREATE TABLE IF NOT EXISTS bds_payment_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES bds_tenants (id),
  transaction_id UUID NOT NULL REFERENCES bds_transactions (id) ON DELETE CASCADE,
  project_id INTEGER NOT NULL REFERENCES crm_re_projects (id) ON DELETE CASCADE,
  policy_id UUID,
  source TEXT NOT NULL DEFAULT 'deposit'
    CHECK (source IN ('deposit', 'vbtt', 'manual')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_bds_payment_schedule_tx
  ON bds_payment_schedules (transaction_id);

CREATE TABLE IF NOT EXISTS bds_payment_installments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES bds_tenants (id),
  schedule_id UUID NOT NULL REFERENCES bds_payment_schedules (id) ON DELETE CASCADE,
  transaction_id UUID NOT NULL REFERENCES bds_transactions (id) ON DELETE CASCADE,
  seq INTEGER NOT NULL DEFAULT 0,
  milestone_code TEXT NOT NULL DEFAULT '',
  due_date DATE NOT NULL,
  amount_vnd BIGINT NOT NULL DEFAULT 0,
  paid_vnd BIGINT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'due'
    CHECK (status IN ('due', 'partial', 'paid', 'overdue', 'waived')),
  overdue_days INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_bds_installment_schedule_seq
  ON bds_payment_installments (schedule_id, seq);

CREATE INDEX IF NOT EXISTS idx_bds_installments_tx
  ON bds_payment_installments (transaction_id);

CREATE TABLE IF NOT EXISTS bds_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES bds_tenants (id),
  transaction_id UUID NOT NULL REFERENCES bds_transactions (id) ON DELETE CASCADE,
  installment_id UUID REFERENCES bds_payment_installments (id),
  receipt_no TEXT NOT NULL DEFAULT '',
  amount_vnd BIGINT NOT NULL DEFAULT 0,
  paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  method TEXT NOT NULL DEFAULT 'bank'
    CHECK (method IN ('bank', 'cash', 'loan')),
  note TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bds_receipts_tx
  ON bds_receipts (transaction_id);

CREATE TABLE IF NOT EXISTS bds_mortgages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES bds_tenants (id),
  transaction_id UUID NOT NULL REFERENCES bds_transactions (id) ON DELETE CASCADE,
  bank_name TEXT NOT NULL DEFAULT '',
  amount_vnd BIGINT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'applying'
    CHECK (status IN ('applying', 'approved', 'disbursed', 'rejected')),
  file_id TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_bds_mortgage_tx
  ON bds_mortgages (transaction_id);

COMMIT;
