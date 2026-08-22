-- Pack BĐS P4 — Apply: scripts/apply_pg_ddl_bds_p4.sh
BEGIN;

CREATE TABLE IF NOT EXISTS bds_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES bds_tenants (id),
  project_id INTEGER NOT NULL REFERENCES crm_re_projects (id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES crm_re_project_products (id) ON DELETE CASCADE,
  hold_id UUID,
  lead_id INTEGER NOT NULL,
  buyer_id UUID,
  policy_id UUID,
  channel_partner_id TEXT NOT NULL DEFAULT '',
  closer_staff_id INTEGER,
  first_touch_staff_id INTEGER,
  stage TEXT NOT NULL DEFAULT 'deposit'
    CHECK (stage IN (
      'reservation', 'deposit', 'vbtt', 'contracted',
      'handed_over', 'title_issued', 'cancelled', 'lost'
    )),
  channel TEXT NOT NULL DEFAULT 'inhouse'
    CHECK (channel IN ('inhouse', 'agency')),
  list_price_vnd BIGINT NOT NULL DEFAULT 0,
  net_price_vnd BIGINT NOT NULL DEFAULT 0,
  discount_vnd BIGINT NOT NULL DEFAULT 0,
  reservation_fee_vnd BIGINT NOT NULL DEFAULT 0,
  reservation_paid_at TIMESTAMPTZ,
  deposit_vnd BIGINT NOT NULL DEFAULT 0,
  deposit_paid_at TIMESTAMPTZ,
  vbtt_no TEXT NOT NULL DEFAULT '',
  vbtt_at TIMESTAMPTZ,
  contract_no TEXT NOT NULL DEFAULT '',
  contracted_at TIMESTAMPTZ,
  paid_pct NUMERIC NOT NULL DEFAULT 0,
  mortgage_status TEXT NOT NULL DEFAULT 'none'
    CHECK (mortgage_status IN ('none', 'applying', 'approved', 'disbursed', 'rejected')),
  handover_at TIMESTAMPTZ,
  title_issued_at TIMESTAMPTZ,
  lost_reason TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_bds_tx_one_open
  ON bds_transactions (product_id)
  WHERE stage NOT IN ('cancelled', 'lost');

CREATE INDEX IF NOT EXISTS idx_bds_tx_project_stage
  ON bds_transactions (project_id, stage);

COMMIT;
