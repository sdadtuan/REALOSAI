-- Pack BĐS P5 — Apply: scripts/apply_pg_ddl_bds_p5.sh
BEGIN;

CREATE TABLE IF NOT EXISTS bds_tier_defs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES bds_tenants (id),
  code TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  min_score INTEGER NOT NULL DEFAULT 0,
  max_concurrent_holds INTEGER NOT NULL DEFAULT 3,
  exclusive_allowed BOOLEAN NOT NULL DEFAULT FALSE,
  ttl_multiplier NUMERIC NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, code)
);

CREATE TABLE IF NOT EXISTS bds_agencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES bds_tenants (id),
  code TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  legal_name TEXT NOT NULL DEFAULT '',
  tax_id TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL DEFAULT 'f1'
    CHECK (kind IN (
      'inhouse', 'tong_dai_ly', 'f1', 'f2', 'alliance', 'ctv_network'
    )),
  parent_agency_id UUID REFERENCES bds_agencies (id),
  status TEXT NOT NULL DEFAULT 'prospect'
    CHECK (status IN (
      'prospect', 'onboarding', 'active', 'probation', 'suspended', 'terminated'
    )),
  tier_id UUID REFERENCES bds_tier_defs (id),
  tier_override BOOLEAN NOT NULL DEFAULT FALSE,
  tier_override_reason TEXT NOT NULL DEFAULT '',
  tier_override_until DATE,
  owner_staff_id INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_bds_agency_tenant_code
  ON bds_agencies (tenant_id, code);

CREATE TABLE IF NOT EXISTS bds_agency_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES bds_agencies (id) ON DELETE CASCADE,
  project_id INTEGER NOT NULL REFERENCES crm_re_projects (id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('draft', 'active', 'expired', 'terminated')),
  signed_on DATE,
  expires_on DATE,
  exclusive_project BOOLEAN NOT NULL DEFAULT FALSE,
  max_concurrent_holds INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_bds_agency_contract_open
  ON bds_agency_contracts (agency_id, project_id)
  WHERE status = 'active';

CREATE TABLE IF NOT EXISTS bds_basket_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES bds_agencies (id) ON DELETE CASCADE,
  project_id INTEGER NOT NULL REFERENCES crm_re_projects (id) ON DELETE CASCADE,
  scope_type TEXT NOT NULL DEFAULT 'units'
    CHECK (scope_type IN ('units', 'zone', 'tower', 'phase', 'product_line')),
  exclusivity TEXT NOT NULL DEFAULT 'shared'
    CHECK (exclusivity IN ('exclusive', 'shared')),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_bds_basket_rule_agency_project
  ON bds_basket_rules (agency_id, project_id)
  WHERE status = 'active';

CREATE TABLE IF NOT EXISTS bds_basket_units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID NOT NULL REFERENCES bds_basket_rules (id) ON DELETE CASCADE,
  agency_id UUID NOT NULL REFERENCES bds_agencies (id) ON DELETE CASCADE,
  project_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL REFERENCES crm_re_project_products (id) ON DELETE CASCADE,
  exclusivity TEXT NOT NULL DEFAULT 'shared'
    CHECK (exclusivity IN ('exclusive', 'shared')),
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  granted_by TEXT NOT NULL DEFAULT '',
  revoked_at TIMESTAMPTZ,
  revoke_reason TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_bds_basket_exclusive_unit
  ON bds_basket_units (product_id)
  WHERE exclusivity = 'exclusive' AND revoked_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_bds_basket_agency_unit_open
  ON bds_basket_units (agency_id, product_id)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_bds_basket_units_agency
  ON bds_basket_units (agency_id, project_id)
  WHERE revoked_at IS NULL;

COMMIT;
