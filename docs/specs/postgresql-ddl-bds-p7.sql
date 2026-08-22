BEGIN;

ALTER TABLE bds_agency_contracts
  ADD COLUMN IF NOT EXISTS advance_cap_vnd BIGINT,
  ADD COLUMN IF NOT EXISTS clawback_days INTEGER;

CREATE TABLE IF NOT EXISTS bds_commission_schemes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES bds_tenants (id),
  project_id INTEGER NOT NULL REFERENCES crm_re_projects (id),
  phase_id UUID,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'archived')),
  base TEXT NOT NULL DEFAULT 'net'
    CHECK (base IN ('net', 'list')),
  currency TEXT NOT NULL DEFAULT 'VND',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_bds_commission_scheme_active
  ON bds_commission_schemes (tenant_id, project_id, COALESCE(phase_id, '00000000-0000-0000-0000-000000000000'))
  WHERE status = 'active';

CREATE TABLE IF NOT EXISTS bds_commission_scheme_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scheme_id UUID NOT NULL REFERENCES bds_commission_schemes (id) ON DELETE CASCADE,
  min_tier_id UUID NOT NULL REFERENCES bds_tier_defs (id),
  product_line TEXT NOT NULL DEFAULT '',
  pct NUMERIC NOT NULL,
  bonus_units_from INTEGER,
  bonus_extra_pct NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bds_commission_payout_splits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scheme_id UUID NOT NULL REFERENCES bds_commission_schemes (id) ON DELETE CASCADE,
  trigger_stage TEXT NOT NULL
    CHECK (trigger_stage IN ('vbtt', 'contracted', 'handed_over')),
  pct NUMERIC NOT NULL,
  UNIQUE (scheme_id, trigger_stage)
);

CREATE TABLE IF NOT EXISTS bds_commission_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES bds_tenants (id),
  agency_id UUID NOT NULL REFERENCES bds_agencies (id),
  transaction_id UUID NOT NULL REFERENCES bds_transactions (id),
  scheme_id UUID REFERENCES bds_commission_schemes (id),
  scheme_tier_id UUID REFERENCES bds_commission_scheme_tiers (id),
  trigger_stage TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'accrued'
    CHECK (status IN ('accrued', 'paid', 'clawback')),
  base_vnd BIGINT NOT NULL,
  pct NUMERIC NOT NULL,
  amount_vnd BIGINT NOT NULL,
  period_month DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_bds_commission_ledger_tx_trigger
  ON bds_commission_ledger (transaction_id, trigger_stage)
  WHERE status <> 'clawback';

CREATE INDEX IF NOT EXISTS idx_bds_commission_ledger_agency
  ON bds_commission_ledger (agency_id, period_month);

CREATE TABLE IF NOT EXISTS bds_commission_statements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES bds_tenants (id),
  agency_id UUID NOT NULL REFERENCES bds_agencies (id),
  period_month DATE NOT NULL,
  gross_vnd BIGINT NOT NULL DEFAULT 0,
  advance_vnd BIGINT NOT NULL DEFAULT 0,
  clawback_vnd BIGINT NOT NULL DEFAULT 0,
  net_vnd BIGINT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'locked', 'approved', 'paid')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (agency_id, period_month)
);

CREATE TABLE IF NOT EXISTS bds_commission_advances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES bds_tenants (id),
  agency_id UUID NOT NULL REFERENCES bds_agencies (id),
  amount_vnd BIGINT NOT NULL,
  period_month DATE NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bds_agency_tier_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES bds_tenants (id),
  agency_id UUID NOT NULL REFERENCES bds_agencies (id),
  period_month DATE NOT NULL,
  gmv_score NUMERIC NOT NULL DEFAULT 0,
  units_score NUMERIC NOT NULL DEFAULT 0,
  total_score NUMERIC NOT NULL DEFAULT 0,
  from_tier_id UUID REFERENCES bds_tier_defs (id),
  to_tier_id UUID REFERENCES bds_tier_defs (id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (agency_id, period_month)
);

CREATE TABLE IF NOT EXISTS bds_capi_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES bds_tenants (id),
  transaction_id UUID REFERENCES bds_transactions (id),
  lead_id BIGINT,
  event_name TEXT NOT NULL,
  value_vnd BIGINT,
  status TEXT NOT NULL DEFAULT 'logged'
    CHECK (status IN ('logged', 'skipped', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMIT;
