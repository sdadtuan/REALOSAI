-- Pack BĐS P2 — Apply: scripts/apply_pg_ddl_bds_p2.sh
BEGIN;

CREATE TABLE IF NOT EXISTS bds_holds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES bds_tenants (id),
  project_id INTEGER NOT NULL REFERENCES crm_re_projects (id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES crm_re_project_products (id) ON DELETE CASCADE,
  lead_id INTEGER NOT NULL,
  buyer_id UUID,
  requested_by_staff_id INTEGER,
  channel_partner_id TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'expired', 'cancelled', 'converted', 'rejected')),
  expires_at TIMESTAMPTZ,
  note TEXT NOT NULL DEFAULT '',
  approved_by TEXT NOT NULL DEFAULT '',
  approved_at TIMESTAMPTZ,
  cancelled_reason TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_bds_holds_one_open
  ON bds_holds (product_id)
  WHERE status IN ('pending', 'active');

CREATE INDEX IF NOT EXISTS idx_bds_holds_expires
  ON bds_holds (expires_at)
  WHERE status = 'active';

CREATE TABLE IF NOT EXISTS bds_idempotency_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route TEXT NOT NULL,
  key TEXT NOT NULL,
  request_hash TEXT NOT NULL DEFAULT '',
  status_code INTEGER NOT NULL,
  response_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (route, key)
);

COMMIT;
