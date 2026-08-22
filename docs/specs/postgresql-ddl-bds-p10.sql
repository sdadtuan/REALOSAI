-- Pack BĐS P10 — Apply: scripts/apply_pg_ddl_bds_p10.sh
BEGIN;

CREATE TABLE IF NOT EXISTS bds_launches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES bds_tenants (id),
  project_id INTEGER NOT NULL REFERENCES crm_re_projects (id) ON DELETE CASCADE,
  phase_id UUID REFERENCES bds_launch_phases (id),
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  hold_ttl_seconds INTEGER NOT NULL DEFAULT 180
    CHECK (hold_ttl_seconds > 0 AND hold_ttl_seconds <= 86400),
  price_list_id INTEGER,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'open', 'closed')),
  opened_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_bds_launches_one_open
  ON bds_launches (project_id)
  WHERE status = 'open';

CREATE INDEX IF NOT EXISTS idx_bds_launches_tenant_status
  ON bds_launches (tenant_id, status);

CREATE TABLE IF NOT EXISTS bds_unit_queues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES bds_tenants (id),
  launch_id UUID NOT NULL REFERENCES bds_launches (id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES crm_re_project_products (id) ON DELETE CASCADE,
  lead_id INTEGER NOT NULL,
  requested_by_staff_id INTEGER,
  channel_partner_id TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'waiting'
    CHECK (status IN ('waiting', 'promoted', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_bds_unit_queues_waiting
  ON bds_unit_queues (launch_id, product_id, lead_id)
  WHERE status = 'waiting';

CREATE INDEX IF NOT EXISTS idx_bds_unit_queues_fifo
  ON bds_unit_queues (launch_id, product_id, created_at)
  WHERE status = 'waiting';

COMMIT;
