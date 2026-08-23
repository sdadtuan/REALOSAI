-- Zero SQLite Wave 1 P3 — orders, invoices, sales, owner-weekly
-- Prerequisite: P2 DDL + RNOS-25 orders/invoices base applied
BEGIN;

-- ---------------------------------------------------------------------------
-- RNOS-25 bridge columns (idempotent)
-- ---------------------------------------------------------------------------

ALTER TABLE crm_orders ADD COLUMN IF NOT EXISTS sqlite_order_id BIGINT UNIQUE;
ALTER TABLE crm_order_lines ADD COLUMN IF NOT EXISTS sqlite_line_id BIGINT UNIQUE;
ALTER TABLE crm_invoices ADD COLUMN IF NOT EXISTS sqlite_invoice_id BIGINT UNIQUE;
ALTER TABLE crm_invoice_lines ADD COLUMN IF NOT EXISTS sqlite_line_id BIGINT UNIQUE;

-- ---------------------------------------------------------------------------
-- sales (Nest sqlite parity)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS crm_sales_plans (
  id BIGSERIAL PRIMARY KEY,
  sqlite_plan_id BIGINT UNIQUE,
  title TEXT NOT NULL DEFAULT '',
  fiscal_year INT NOT NULL DEFAULT 0,
  period_start TEXT NOT NULL DEFAULT '',
  period_end TEXT NOT NULL DEFAULT '',
  revenue_target_vnd BIGINT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  summary TEXT NOT NULL DEFAULT '',
  strategy_notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS crm_sales_targets (
  id BIGSERIAL PRIMARY KEY,
  sqlite_target_id BIGINT UNIQUE,
  plan_id BIGINT NOT NULL REFERENCES crm_sales_plans(id) ON DELETE CASCADE,
  staff_id BIGINT,
  department_id BIGINT,
  target_value BIGINT NOT NULL DEFAULT 0,
  actual_value BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS crm_sales_partners (
  id BIGSERIAL PRIMARY KEY,
  sqlite_partner_id BIGINT UNIQUE,
  partner_type TEXT NOT NULL DEFAULT 'ctv',
  name TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  company TEXT NOT NULL DEFAULT '',
  territory TEXT NOT NULL DEFAULT '',
  commission_pct DOUBLE PRECISION,
  status TEXT NOT NULL DEFAULT 'active',
  assigned_staff_id BIGINT,
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS crm_sales_trainings (
  id BIGSERIAL PRIMARY KEY,
  sqlite_training_id BIGINT UNIQUE,
  title TEXT NOT NULL DEFAULT '',
  training_date TEXT NOT NULL DEFAULT '',
  trainer_name TEXT NOT NULL DEFAULT '',
  topic TEXT NOT NULL DEFAULT '',
  content_summary TEXT NOT NULL DEFAULT '',
  materials_url TEXT NOT NULL DEFAULT '',
  attendee_staff_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'planned',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS crm_sales_market_research (
  id BIGSERIAL PRIMARY KEY,
  sqlite_research_id BIGINT UNIQUE,
  title TEXT NOT NULL DEFAULT '',
  research_date TEXT NOT NULL DEFAULT '',
  area TEXT NOT NULL DEFAULT '',
  property_type TEXT NOT NULL DEFAULT '',
  competitor_notes TEXT NOT NULL DEFAULT '',
  price_analysis TEXT NOT NULL DEFAULT '',
  strategy_proposal TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS crm_sales_transactions (
  id BIGSERIAL PRIMARY KEY,
  sqlite_tx_id BIGINT UNIQUE,
  case_id BIGINT REFERENCES crm_cases(id) ON DELETE SET NULL,
  contract_id BIGINT,
  customer_id BIGINT REFERENCES crm_customers(id) ON DELETE SET NULL,
  transaction_type TEXT NOT NULL DEFAULT 'ban',
  property_ref TEXT NOT NULL DEFAULT '',
  stage TEXT NOT NULL DEFAULT 'tu_van',
  deal_value_vnd BIGINT NOT NULL DEFAULT 0,
  assigned_staff_id BIGINT,
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_sales_transactions_case ON crm_sales_transactions (case_id);
CREATE INDEX IF NOT EXISTS idx_crm_sales_transactions_customer ON crm_sales_transactions (customer_id);

-- ---------------------------------------------------------------------------
-- owner-weekly (sqlite parity — snapshot_on / balance_vnd)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS crm_owner_weekly_config (
  config_key TEXT PRIMARY KEY,
  config_value TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS crm_owner_cash_snapshots (
  id BIGSERIAL PRIMARY KEY,
  sqlite_snapshot_id BIGINT UNIQUE,
  snapshot_on DATE NOT NULL,
  balance_vnd BIGINT NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'manual',
  notes TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (snapshot_on)
);

COMMIT;
