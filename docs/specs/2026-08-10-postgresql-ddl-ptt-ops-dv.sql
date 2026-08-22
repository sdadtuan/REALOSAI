-- PTT Ops DV01–DV21 — PostgreSQL DDL extension
-- Date: 2026-08-10
-- Design: docs/superpowers/specs/2026-08-10-ptt-ops-dv-os-design.md
-- Apply via ops-profile-pg.repository bootstrap (idempotent CREATE IF NOT EXISTS)

-- ---------------------------------------------------------------------------
-- 1. Extend CRM catalog with DV code (optional column)
-- ---------------------------------------------------------------------------
ALTER TABLE crm_catalog_services
  ADD COLUMN IF NOT EXISTS dv_code VARCHAR(8) NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_crm_catalog_services_dv_code
  ON crm_catalog_services (dv_code)
  WHERE dv_code IS NOT NULL;

COMMENT ON COLUMN crm_catalog_services.dv_code IS 'PTT Ops DV code, e.g. DV02';

-- ---------------------------------------------------------------------------
-- 2. Ops service profile — one row per DV / primary slug
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ops_service_profile (
  id SERIAL PRIMARY KEY,
  dv_code VARCHAR(8) NOT NULL UNIQUE,
  service_slug VARCHAR(80) NOT NULL,
  name VARCHAR(200) NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  readiness VARCHAR(20) NOT NULL DEFAULT 'partial'
    CHECK (readiness IN ('ready', 'partial', 'gap')),
  service_slugs_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  ops_web_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  nest_api_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  weekly_process_template JSONB NOT NULL DEFAULT '[]'::jsonb,
  kpi_definitions JSONB NOT NULL DEFAULT '[]'::jsonb,
  tier_pricing JSONB NOT NULL DEFAULT '{}'::jsonb,
  depends_on_dv JSONB NOT NULL DEFAULT '[]'::jsonb,
  gaps JSONB NOT NULL DEFAULT '[]'::jsonb,
  sort_order INT NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ops_service_profile_slug
  ON ops_service_profile (service_slug);

CREATE INDEX IF NOT EXISTS idx_ops_service_profile_readiness
  ON ops_service_profile (readiness)
  WHERE active = TRUE;

COMMENT ON TABLE ops_service_profile IS 'DV01–DV21 profile synced from ops-dv01-dv21-route-map.json';

-- ---------------------------------------------------------------------------
-- 3. Weekly spawn idempotency log
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ops_weekly_spawn_log (
  id SERIAL PRIMARY KEY,
  lifecycle_id INT NOT NULL,
  iso_week VARCHAR(10) NOT NULL,
  dv_code VARCHAR(8) NOT NULL,
  tasks_created INT NOT NULL DEFAULT 0,
  spawned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  spawned_by VARCHAR(80) NOT NULL DEFAULT 'system',
  UNIQUE (lifecycle_id, iso_week)
);

CREATE INDEX IF NOT EXISTS idx_ops_weekly_spawn_lifecycle
  ON ops_weekly_spawn_log (lifecycle_id);

-- ---------------------------------------------------------------------------
-- 4. KPI records per lifecycle + period
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ops_kpi_record (
  id SERIAL PRIMARY KEY,
  lifecycle_id INT NOT NULL,
  dv_code VARCHAR(8) NOT NULL,
  period_type VARCHAR(10) NOT NULL CHECK (period_type IN ('week', 'month')),
  period_key VARCHAR(20) NOT NULL,
  metrics_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  source VARCHAR(40) NOT NULL DEFAULT 'manual',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (lifecycle_id, period_type, period_key)
);

CREATE INDEX IF NOT EXISTS idx_ops_kpi_record_lifecycle
  ON ops_kpi_record (lifecycle_id);

CREATE INDEX IF NOT EXISTS idx_ops_kpi_record_dv_period
  ON ops_kpi_record (dv_code, period_type, period_key);

-- ---------------------------------------------------------------------------
-- 5. Optional: weekly checklist items (M1 fallback if SOP not bound)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ops_weekly_checklist_item (
  id SERIAL PRIMARY KEY,
  lifecycle_id INT NOT NULL,
  iso_week VARCHAR(10) NOT NULL,
  template_task_id VARCHAR(80) NOT NULL,
  title VARCHAR(500) NOT NULL,
  owner_role VARCHAR(80) NOT NULL DEFAULT '',
  day_of_week SMALLINT NULL CHECK (day_of_week BETWEEN 1 AND 7),
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'done', 'skipped')),
  kpi_key VARCHAR(80) NULL,
  completed_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (lifecycle_id, iso_week, template_task_id)
);

CREATE INDEX IF NOT EXISTS idx_ops_weekly_checklist_lifecycle_week
  ON ops_weekly_checklist_item (lifecycle_id, iso_week);

-- ---------------------------------------------------------------------------
-- 6. service_lifecycle extension (metadata already JSONB — document keys)
-- Recommended metadata keys:
--   dv_code, package_tier (basic|standard|premium)
-- Optional future column:
-- ALTER TABLE service_lifecycle ADD COLUMN IF NOT EXISTS package_tier VARCHAR(20) NULL;

-- ---------------------------------------------------------------------------
-- 8. Ops alert log (INT-P3 L2 agent)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ops_alert_log (
  id SERIAL PRIMARY KEY,
  lifecycle_id INT NOT NULL,
  dv_code VARCHAR(8) NOT NULL,
  alert_type VARCHAR(40) NOT NULL,
  severity VARCHAR(20) NOT NULL DEFAULT 'warning',
  title VARCHAR(500) NOT NULL,
  message TEXT NOT NULL DEFAULT '',
  source_key VARCHAR(160) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'open',
  acknowledged_by VARCHAR(80) NULL,
  acknowledged_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source_key)
);

CREATE INDEX IF NOT EXISTS idx_ops_alert_lifecycle
  ON ops_alert_log (lifecycle_id);

CREATE INDEX IF NOT EXISTS idx_ops_alert_status
  ON ops_alert_log (status)
  WHERE status = 'open';

COMMENT ON TABLE ops_alert_log IS 'L2 Ops Agent alerts — task due/overdue + KPI CanChuY/KhongDat';
-- Example single-row upsert (DV02 pilot):
--
-- INSERT INTO ops_service_profile (
--   dv_code, service_slug, name, readiness, service_slugs_json, ops_web_json
-- ) VALUES (
--   'DV02',
--   'tiep-thi-noi-dung',
--   'Tiếp thị nội dung',
--   'ready',
--   '{"primary":"tiep-thi-noi-dung","aliases":[]}'::jsonb,
--   '{"engine_routes":[{"label":"Content OS","path":"/content-os"}]}'::jsonb
-- )
-- ON CONFLICT (dv_code) DO UPDATE SET
--   service_slug = EXCLUDED.service_slug,
--   name = EXCLUDED.name,
--   readiness = EXCLUDED.readiness,
--   updated_at = NOW();
