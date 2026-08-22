-- Pack BĐS P1 — Apply: scripts/apply_pg_ddl_bds_p1.sh
BEGIN;

CREATE TABLE IF NOT EXISTS crm_re_project_products (
  id INTEGER PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES crm_re_projects (id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES bds_tenants (id),
  unit_code TEXT NOT NULL DEFAULT '',
  tower TEXT NOT NULL DEFAULT '',
  floor TEXT NOT NULL DEFAULT '',
  product_line TEXT NOT NULL DEFAULT '',
  zone TEXT NOT NULL DEFAULT '',
  typology TEXT NOT NULL DEFAULT '',
  is_corner BOOLEAN NOT NULL DEFAULT FALSE,
  sales_staff_id INTEGER,
  product_type TEXT NOT NULL DEFAULT '',
  area_m2 NUMERIC,
  bedrooms INTEGER,
  direction TEXT NOT NULL DEFAULT '',
  view_type TEXT NOT NULL DEFAULT '',
  list_price_vnd BIGINT NOT NULL DEFAULT 0,
  net_price_vnd BIGINT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'available'
    CHECK (status IN ('available', 'hold', 'reserved', 'booked', 'sold', 'locked')),
  notes TEXT NOT NULL DEFAULT '',
  price_batch TEXT NOT NULL DEFAULT '',
  hold_lead_id INTEGER,
  hold_at TEXT NOT NULL DEFAULT '',
  hold_id UUID,
  pool TEXT NOT NULL DEFAULT 'inhouse'
    CHECK (pool IN ('inhouse', 'channel', 'reserved_vip', 'reserved_staff')),
  row_version BIGINT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE crm_re_project_products ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES bds_tenants (id);
ALTER TABLE crm_re_project_products ADD COLUMN IF NOT EXISTS hold_id UUID;
ALTER TABLE crm_re_project_products ADD COLUMN IF NOT EXISTS pool TEXT NOT NULL DEFAULT 'inhouse';
ALTER TABLE crm_re_project_products ADD COLUMN IF NOT EXISTS row_version BIGINT NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_crm_re_products_project
  ON crm_re_project_products (project_id, status);
CREATE INDEX IF NOT EXISTS idx_crm_re_products_tenant
  ON crm_re_project_products (tenant_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_crm_re_products_unit
  ON crm_re_project_products (project_id, lower(trim(unit_code)))
  WHERE trim(unit_code) <> '';

COMMIT;
