-- Pack BĐS P0 — Apply: scripts/apply_pg_ddl_bds_p0.sh
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

BEGIN;

CREATE TABLE IF NOT EXISTS bds_tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code CITEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('developer', 'broker', 'hybrid')),
  legal_name TEXT NOT NULL DEFAULT '',
  tax_id TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'suspended')),
  operated_by_ptt BOOLEAN NOT NULL DEFAULT FALSE,
  settings_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS crm_re_projects (
  id INTEGER PRIMARY KEY,
  code TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'planning',
  developer_name TEXT NOT NULL DEFAULT '',
  tenant_id UUID REFERENCES bds_tenants (id),
  developer_org_name TEXT NOT NULL DEFAULT '',
  legal_gate TEXT NOT NULL DEFAULT 'blocked'
    CHECK (legal_gate IN ('blocked', 'enough_to_sell', 'restricted')),
  one_price BOOLEAN NOT NULL DEFAULT TRUE,
  hdmb_min_paid_pct NUMERIC(5,2) NOT NULL DEFAULT 30,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE crm_re_projects ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES bds_tenants (id);
ALTER TABLE crm_re_projects ADD COLUMN IF NOT EXISTS developer_org_name TEXT NOT NULL DEFAULT '';
ALTER TABLE crm_re_projects ADD COLUMN IF NOT EXISTS legal_gate TEXT NOT NULL DEFAULT 'blocked';
ALTER TABLE crm_re_projects ADD COLUMN IF NOT EXISTS one_price BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE crm_re_projects ADD COLUMN IF NOT EXISTS hdmb_min_paid_pct NUMERIC(5,2) NOT NULL DEFAULT 30;

CREATE INDEX IF NOT EXISTS idx_crm_re_projects_tenant ON crm_re_projects (tenant_id);

COMMIT;
