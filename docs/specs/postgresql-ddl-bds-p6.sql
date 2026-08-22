BEGIN;

CREATE TABLE IF NOT EXISTS bds_buyers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES bds_tenants (id),
  full_name TEXT NOT NULL DEFAULT '',
  phone_e164 TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  id_number TEXT NOT NULL DEFAULT '',
  budget_vnd BIGINT,
  need_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_bds_buyers_tenant_phone
  ON bds_buyers (tenant_id, phone_e164)
  WHERE phone_e164 <> '';

CREATE TABLE IF NOT EXISTS bds_site_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES bds_tenants (id),
  lead_id BIGINT NOT NULL,
  product_id BIGINT REFERENCES crm_re_project_products (id),
  staff_id BIGINT NOT NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  outcome TEXT NOT NULL DEFAULT 'planned'
    CHECK (outcome IN ('planned', 'showed', 'no_show', 'cancelled')),
  note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bds_site_visits_lead ON bds_site_visits (lead_id);

COMMIT;
