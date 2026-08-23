-- Zero SQLite Wave 1 P2 — proposals, marketing-plans official, crm-config
-- Prerequisite: P1 DDL + Wave B5 bridge applied
BEGIN;

-- ---------------------------------------------------------------------------
-- crm-config (pipeline + lookups + custom fields)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS crm_custom_field_defs (
  id BIGSERIAL PRIMARY KEY,
  sqlite_field_id BIGINT UNIQUE,
  entity_type TEXT NOT NULL,
  field_key TEXT NOT NULL,
  label TEXT NOT NULL DEFAULT '',
  field_type TEXT NOT NULL DEFAULT 'text',
  options_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  required BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INT NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (entity_type, field_key)
);

CREATE TABLE IF NOT EXISTS crm_pipeline_stages (
  id BIGSERIAL PRIMARY KEY,
  sqlite_stage_id BIGINT UNIQUE,
  pipeline_key TEXT NOT NULL DEFAULT 'sales',
  stage_key TEXT NOT NULL,
  label TEXT NOT NULL DEFAULT '',
  sort_order INT NOT NULL DEFAULT 0,
  sla_hours INT NOT NULL DEFAULT 0,
  owner_role TEXT NOT NULL DEFAULT '',
  is_terminal BOOLEAN NOT NULL DEFAULT FALSE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (pipeline_key, stage_key)
);

CREATE TABLE IF NOT EXISTS crm_lead_lookup_options (
  id BIGSERIAL PRIMARY KEY,
  sqlite_lookup_id BIGINT UNIQUE,
  kind TEXT NOT NULL,
  option_key TEXT NOT NULL,
  label TEXT NOT NULL DEFAULT '',
  sort_order INT NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (kind, option_key)
);

CREATE INDEX IF NOT EXISTS idx_crm_lead_lookup_kind ON crm_lead_lookup_options (kind);

-- ---------------------------------------------------------------------------
-- crm_proposals + quote lines (Nest sqlite parity)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS crm_proposals (
  id BIGSERIAL PRIMARY KEY,
  sqlite_proposal_id BIGINT UNIQUE,
  customer_id BIGINT NOT NULL REFERENCES crm_customers (id) ON DELETE CASCADE,
  lead_id BIGINT,
  presales_id BIGINT,
  lifecycle_id BIGINT,
  service_slugs TEXT NOT NULL DEFAULT '[]',
  total_vnd BIGINT NOT NULL DEFAULT 0,
  timeline_months INT NOT NULL DEFAULT 1,
  notes TEXT NOT NULL DEFAULT '',
  ai_output TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'draft',
  valid_until TEXT,
  price_adjustment_reason TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_proposals_customer ON crm_proposals (customer_id);
CREATE INDEX IF NOT EXISTS idx_crm_proposals_lead ON crm_proposals (lead_id);

CREATE TABLE IF NOT EXISTS crm_quote_line_item (
  id BIGSERIAL PRIMARY KEY,
  sqlite_line_id BIGINT UNIQUE,
  proposal_id BIGINT NOT NULL REFERENCES crm_proposals (id) ON DELETE CASCADE,
  dv_code TEXT NOT NULL DEFAULT '',
  sku_code TEXT,
  package_tier TEXT NOT NULL DEFAULT 'standard',
  service_slug TEXT NOT NULL DEFAULT '',
  reference_price_min BIGINT NOT NULL DEFAULT 0,
  reference_price_max BIGINT NOT NULL DEFAULT 0,
  final_price_vnd BIGINT NOT NULL DEFAULT 0,
  scope_notes TEXT NOT NULL DEFAULT '',
  lifecycle_id BIGINT,
  sort_order INT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_crm_quote_line_proposal ON crm_quote_line_item (proposal_id);

-- Deal-room lead context (optional FKs — columns only if table exists)
ALTER TABLE crm_proposals
  ADD COLUMN IF NOT EXISTS lead_id BIGINT,
  ADD COLUMN IF NOT EXISTS presales_id BIGINT;

-- ---------------------------------------------------------------------------
-- crm_marketing_plans_official (Nest TMMT — separate from B4 presales draft)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS crm_marketing_plans_official (
  id BIGSERIAL PRIMARY KEY,
  sqlite_plan_id BIGINT UNIQUE,
  code TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft',
  priority TEXT NOT NULL DEFAULT 'normal',
  fiscal_year INT NOT NULL DEFAULT 0,
  period_label TEXT NOT NULL DEFAULT '',
  north_star TEXT NOT NULL DEFAULT '',
  objectives TEXT NOT NULL DEFAULT '',
  pillars_json TEXT NOT NULL DEFAULT '[]',
  audiences TEXT NOT NULL DEFAULT '',
  channels_focus_json TEXT NOT NULL DEFAULT '[]',
  budget_planned_vnd BIGINT NOT NULL DEFAULT 0,
  budget_actual_vnd BIGINT NOT NULL DEFAULT 0,
  success_metrics_json TEXT NOT NULL DEFAULT '[]',
  risks_notes TEXT NOT NULL DEFAULT '',
  owner_staff_id BIGINT,
  start_date TEXT NOT NULL DEFAULT '',
  end_date TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  strategy_framework_json TEXT NOT NULL DEFAULT '{}',
  target_market_prof_json TEXT NOT NULL DEFAULT '{}',
  target_market_steps4_json TEXT NOT NULL DEFAULT '{}',
  khtn_market_research_json TEXT NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_marketing_plans_official_year
  ON crm_marketing_plans_official (fiscal_year DESC);

CREATE TABLE IF NOT EXISTS crm_marketing_plan_milestones (
  id BIGSERIAL PRIMARY KEY,
  sqlite_milestone_id BIGINT UNIQUE,
  plan_id BIGINT NOT NULL REFERENCES crm_marketing_plans_official (id) ON DELETE CASCADE,
  position INT NOT NULL DEFAULT 0,
  title TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  due_date TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  owner_staff_id BIGINT,
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_marketing_plan_milestones_plan
  ON crm_marketing_plan_milestones (plan_id);

CREATE TABLE IF NOT EXISTS crm_marketing_plan_campaigns (
  id BIGSERIAL PRIMARY KEY,
  sqlite_link_id BIGINT UNIQUE,
  plan_id BIGINT NOT NULL REFERENCES crm_marketing_plans_official (id) ON DELETE CASCADE,
  campaign_id BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_crm_marketing_plan_campaigns_plan
  ON crm_marketing_plan_campaigns (plan_id);

COMMIT;
