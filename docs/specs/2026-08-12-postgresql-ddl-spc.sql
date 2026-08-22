-- SPC S1 — Service Product Catalog
-- Date: 2026-08-12
-- Spec: docs/superpowers/specs/2026-08-12-service-product-catalog-spc-admin-a-design.md
-- Apply via scripts/apply_pg_ddl_spc.sh or scripts/lib/spc-pg-bootstrap.js (idempotent)

-- ---------------------------------------------------------------------------
-- 1. Extend existing tables (skip if base CRM schema not applied)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'crm_service_lifecycle'
  ) THEN
    ALTER TABLE crm_service_lifecycle
      ADD COLUMN IF NOT EXISTS sku_code VARCHAR(16) NULL;
    COMMENT ON COLUMN crm_service_lifecycle.sku_code IS 'Commercial SKU code, e.g. DV02-TC';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'crm_catalog_services'
  ) THEN
    ALTER TABLE crm_catalog_services
      ADD COLUMN IF NOT EXISTS default_sku_code VARCHAR(16) NULL;
    COMMENT ON COLUMN crm_catalog_services.default_sku_code IS 'Default SPC SKU for CRM slug intake';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2. L0 — service_family (DV portfolio)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS service_family (
  dv_code VARCHAR(8) PRIMARY KEY,
  name_vi VARCHAR(200) NOT NULL,
  department VARCHAR(80) NOT NULL DEFAULT '',
  role_vi TEXT NOT NULL DEFAULT '',
  service_type VARCHAR(20) NOT NULL DEFAULT 'setup_retainer'
    CHECK (service_type IN ('one_time','setup_retainer','retainer','hybrid')),
  description_vi TEXT NOT NULL DEFAULT '',
  risks_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  depends_on_dv JSONB NOT NULL DEFAULT '[]'::jsonb,
  readiness VARCHAR(20) NOT NULL DEFAULT 'partial',
  sort_order INT NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE service_family IS 'L0 SPC portfolio — DV01–DV21 family metadata';

-- ---------------------------------------------------------------------------
-- 3. L1 — service_offer (commercial SKU)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS service_offer (
  sku_code VARCHAR(16) PRIMARY KEY,
  dv_code VARCHAR(8) NOT NULL REFERENCES service_family(dv_code),
  tier VARCHAR(2) NOT NULL CHECK (tier IN ('CB','TC','CS')),
  label_vi VARCHAR(200) NOT NULL,
  scope_summary_vi TEXT NOT NULL DEFAULT '',
  pricing_model JSONB NOT NULL,
  duration_hint_vi VARCHAR(120) NOT NULL DEFAULT '',
  status VARCHAR(20) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','published','archived')),
  published_version INT NOT NULL DEFAULT 0,
  draft_pricing_model JSONB NULL,
  draft_scope_summary_vi TEXT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (dv_code, tier)
);

CREATE INDEX IF NOT EXISTS idx_service_offer_dv ON service_offer (dv_code);

ALTER TABLE service_offer
  ADD COLUMN IF NOT EXISTS draft_pricing_model JSONB NULL,
  ADD COLUMN IF NOT EXISTS draft_scope_summary_vi TEXT NULL;

COMMENT ON TABLE service_offer IS 'L1 SPC commercial SKU — 3 tiers per DV (CB/TC/CS)';

-- ---------------------------------------------------------------------------
-- 4. L2 — service_offer_line (scope lines for quote)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS service_offer_line (
  line_code VARCHAR(24) PRIMARY KEY,
  sku_code VARCHAR(16) NOT NULL REFERENCES service_offer(sku_code),
  label_vi VARCHAR(200) NOT NULL,
  description_vi TEXT NOT NULL DEFAULT '',
  unit VARCHAR(20) NOT NULL DEFAULT 'once',
  included_by_default BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INT NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE
);

COMMENT ON TABLE service_offer_line IS 'L2 SPC scope lines — quote line items per SKU';

-- ---------------------------------------------------------------------------
-- 5. L3 — service_process_phase (weekly process phases)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS service_process_phase (
  phase_code VARCHAR(16) PRIMARY KEY,
  dv_code VARCHAR(8) NOT NULL REFERENCES service_family(dv_code),
  sku_code VARCHAR(16) NULL REFERENCES service_offer(sku_code),
  week_label_vi VARCHAR(80) NOT NULL,
  ptt_work_vi TEXT NOT NULL DEFAULT '',
  deliverable_vi TEXT NOT NULL DEFAULT '',
  client_action_vi TEXT NOT NULL DEFAULT '',
  tasks_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  sort_order INT NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_service_process_dv ON service_process_phase (dv_code);

COMMENT ON TABLE service_process_phase IS 'L3 SPC process phases — DVxx-Tn spawn templates';

-- ---------------------------------------------------------------------------
-- 6. KPI definitions (DV-level + optional SKU override)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS service_kpi_def (
  id SERIAL PRIMARY KEY,
  dv_code VARCHAR(8) NOT NULL REFERENCES service_family(dv_code),
  sku_code VARCHAR(16) NULL REFERENCES service_offer(sku_code),
  kpi_code VARCHAR(40) NOT NULL,
  label_vi VARCHAR(200) NOT NULL,
  unit VARCHAR(40) NOT NULL DEFAULT '',
  target_hint_vi VARCHAR(120) NOT NULL DEFAULT '',
  thresholds_json JSONB NULL,
  sort_order INT NOT NULL DEFAULT 0,
  UNIQUE (dv_code, sku_code, kpi_code)
);

CREATE INDEX IF NOT EXISTS idx_service_kpi_dv ON service_kpi_def (dv_code);

COMMENT ON TABLE service_kpi_def IS 'SPC KPI definitions with optional per-SKU threshold overrides';

-- ---------------------------------------------------------------------------
-- 7. L4 — tmmt_blueprint (TMMT template catalog)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tmmt_blueprint (
  id SERIAL PRIMARY KEY,
  dv_code VARCHAR(8) NOT NULL REFERENCES service_family(dv_code),
  sku_code VARCHAR(16) NULL REFERENCES service_offer(sku_code),
  version INT NOT NULL DEFAULT 1,
  status VARCHAR(20) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','published','archived')),
  brief_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  strategy_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  campaign_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  kpi_tree_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  quality_rubric_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  published_at TIMESTAMPTZ NULL,
  published_by VARCHAR(80) NULL,
  UNIQUE (dv_code, sku_code, version)
);

COMMENT ON TABLE tmmt_blueprint IS 'L4 SPC TMMT blueprint — empty schema in S1, populated on publish';

-- ---------------------------------------------------------------------------
-- 8. Publish audit log
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS spc_publish_log (
  id SERIAL PRIMARY KEY,
  entity_type VARCHAR(40) NOT NULL,
  entity_key VARCHAR(40) NOT NULL,
  action VARCHAR(20) NOT NULL,
  from_version INT NULL,
  to_version INT NULL,
  actor_email VARCHAR(80) NOT NULL,
  diff_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE spc_publish_log IS 'SPC publish workflow audit trail';

-- ---------------------------------------------------------------------------
-- 9. S6 — L0.5 service_component (dịch vụ con) + bundle mapping
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS service_component (
  component_code VARCHAR(16) PRIMARY KEY,
  dv_code VARCHAR(8) NOT NULL REFERENCES service_family(dv_code),
  name_vi VARCHAR(200) NOT NULL,
  description_vi TEXT NOT NULL DEFAULT '',
  deliverable_vi TEXT NOT NULL DEFAULT '',
  pricing_model JSONB NOT NULL DEFAULT '{}'::jsonb,
  unit VARCHAR(20) NOT NULL DEFAULT 'once',
  sort_order INT NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_service_component_dv ON service_component (dv_code);

ALTER TABLE service_component
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','published','archived')),
  ADD COLUMN IF NOT EXISTS published_version INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS draft_pricing_model JSONB NULL,
  ADD COLUMN IF NOT EXISTS draft_name_vi VARCHAR(200) NULL,
  ADD COLUMN IF NOT EXISTS draft_description_vi TEXT NULL,
  ADD COLUMN IF NOT EXISTS draft_deliverable_vi TEXT NULL;

-- S6d — backfill seeded/imported components as published
UPDATE service_component
SET status = 'published',
    published_version = GREATEST(published_version, 1)
WHERE active = TRUE
  AND published_version = 0
  AND pricing_model IS NOT NULL
  AND pricing_model != '{}'::jsonb;

COMMENT ON TABLE service_component IS 'L0.5 SPC sub-service — atomic sellable unit with pricing_model';

CREATE TABLE IF NOT EXISTS service_bundle_item (
  sku_code VARCHAR(16) NOT NULL REFERENCES service_offer(sku_code) ON DELETE CASCADE,
  component_code VARCHAR(16) NOT NULL REFERENCES service_component(component_code),
  included BOOLEAN NOT NULL DEFAULT TRUE,
  qty INT NOT NULL DEFAULT 1,
  price_override_vnd INT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  PRIMARY KEY (sku_code, component_code)
);

CREATE INDEX IF NOT EXISTS idx_service_bundle_sku ON service_bundle_item (sku_code);

COMMENT ON TABLE service_bundle_item IS 'S6 — maps commercial SKU to included service_component items';

ALTER TABLE service_offer_line
  ADD COLUMN IF NOT EXISTS component_code VARCHAR(16) NULL REFERENCES service_component(component_code);

COMMENT ON COLUMN service_offer_line.component_code IS 'S6 optional link to service_component for quote lines';
