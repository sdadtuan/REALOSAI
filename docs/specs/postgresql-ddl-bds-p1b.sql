-- Pack BĐS P1b — Apply: scripts/apply_pg_ddl_bds_p1b.sh
BEGIN;

ALTER TABLE crm_re_projects ADD COLUMN IF NOT EXISTS current_phase_id UUID;
ALTER TABLE crm_re_projects ADD COLUMN IF NOT EXISTS legal_gate_override_until TIMESTAMPTZ;
ALTER TABLE crm_re_projects ADD COLUMN IF NOT EXISTS legal_gate_override_reason TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS bds_towers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES bds_tenants (id),
  project_id INTEGER NOT NULL REFERENCES crm_re_projects (id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  floor_min INTEGER NOT NULL DEFAULT 1,
  floor_max INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_bds_towers_project_code
  ON bds_towers (project_id, lower(trim(code)));

CREATE TABLE IF NOT EXISTS bds_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES bds_tenants (id),
  project_id INTEGER NOT NULL REFERENCES crm_re_projects (id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_bds_zones_project_code
  ON bds_zones (project_id, lower(trim(code)));

CREATE TABLE IF NOT EXISTS bds_unit_layouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES bds_tenants (id),
  project_id INTEGER NOT NULL REFERENCES crm_re_projects (id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  area_m2 NUMERIC,
  list_price_vnd BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_bds_unit_layouts_project_code
  ON bds_unit_layouts (project_id, lower(trim(code)));

CREATE TABLE IF NOT EXISTS bds_legal_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES bds_tenants (id),
  project_id INTEGER NOT NULL REFERENCES crm_re_projects (id) ON DELETE CASCADE,
  doc_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'missing'
    CHECK (status IN ('missing', 'valid', 'expired', 'rejected')),
  file_id TEXT NOT NULL DEFAULT '',
  issued_on DATE,
  expires_on DATE,
  required_for_sale BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_bds_legal_documents_project_type
  ON bds_legal_documents (project_id, doc_type);

CREATE TABLE IF NOT EXISTS bds_launch_phases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES bds_tenants (id),
  project_id INTEGER NOT NULL REFERENCES crm_re_projects (id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'planned'
    CHECK (status IN ('planned', 'active', 'closed')),
  opens_at TIMESTAMPTZ,
  closes_at TIMESTAMPTZ,
  open_to_channel BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_bds_launch_phases_project_code
  ON bds_launch_phases (project_id, lower(trim(code)));

CREATE UNIQUE INDEX IF NOT EXISTS uq_bds_launch_phases_one_active
  ON bds_launch_phases (project_id)
  WHERE status = 'active';

CREATE TABLE IF NOT EXISTS bds_build_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES bds_tenants (id),
  project_id INTEGER NOT NULL REFERENCES crm_re_projects (id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  target_date DATE,
  actual_date DATE,
  status TEXT NOT NULL DEFAULT 'planned'
    CHECK (status IN ('planned', 'reached', 'delayed')),
  unlocks_installment_index INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_bds_build_milestones_project_code
  ON bds_build_milestones (project_id, lower(trim(code)));

CREATE TABLE IF NOT EXISTS bds_plan_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES bds_tenants (id),
  project_id INTEGER NOT NULL REFERENCES crm_re_projects (id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('business', 'marketing', 'sales')),
  version INTEGER NOT NULL,
  body_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'in_review', 'approved', 'rejected')),
  submitted_by TEXT NOT NULL DEFAULT '',
  reviewed_by TEXT NOT NULL DEFAULT '',
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (project_id, kind, version)
);

COMMIT;
