-- RNOS-25 — Order / Invoice schema extension (PostgreSQL target)
-- SQLite canonical in services/ptt-crm-api/src/billing/billing-schema.util.ts

CREATE TABLE IF NOT EXISTS crm_orders (
    id              BIGSERIAL PRIMARY KEY,
    reference_code  TEXT NOT NULL DEFAULT '',
    customer_id     BIGINT NOT NULL REFERENCES crm_customers(id) ON DELETE CASCADE,
    contract_id     BIGINT REFERENCES crm_contracts(id) ON DELETE SET NULL,
    proposal_id     BIGINT REFERENCES crm_proposals(id) ON DELETE SET NULL,
    lifecycle_id    BIGINT REFERENCES crm_service_lifecycle(id) ON DELETE SET NULL,
    lead_id         BIGINT REFERENCES crm_leads(id) ON DELETE SET NULL,
    status          TEXT NOT NULL DEFAULT 'draft',
    order_date      DATE NOT NULL DEFAULT CURRENT_DATE,
    total_vnd       BIGINT NOT NULL DEFAULT 0,
    billing_type    TEXT NOT NULL DEFAULT 'one_off',
    notes           TEXT NOT NULL DEFAULT '',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_orders_customer ON crm_orders (customer_id, status);

CREATE TABLE IF NOT EXISTS crm_order_lines (
    id              BIGSERIAL PRIMARY KEY,
    order_id        BIGINT NOT NULL REFERENCES crm_orders(id) ON DELETE CASCADE,
    product_slug    TEXT NOT NULL DEFAULT '',
    description     TEXT NOT NULL DEFAULT '',
    quantity        INT NOT NULL DEFAULT 1,
    unit_price_vnd  BIGINT NOT NULL DEFAULT 0,
    amount_vnd      BIGINT NOT NULL DEFAULT 0,
    sort_order      INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS crm_invoices (
    id              BIGSERIAL PRIMARY KEY,
    invoice_number  TEXT NOT NULL DEFAULT '',
    order_id        BIGINT REFERENCES crm_orders(id) ON DELETE SET NULL,
    contract_id     BIGINT REFERENCES crm_contracts(id) ON DELETE SET NULL,
    lifecycle_id    BIGINT REFERENCES crm_service_lifecycle(id) ON DELETE SET NULL,
    customer_id     BIGINT NOT NULL REFERENCES crm_customers(id) ON DELETE CASCADE,
    status          TEXT NOT NULL DEFAULT 'draft',
    issued_on       DATE,
    due_on          DATE,
    amount_vnd      BIGINT NOT NULL DEFAULT 0,
    paid_vnd        BIGINT NOT NULL DEFAULT 0,
    notes           TEXT NOT NULL DEFAULT '',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_crm_invoices_number ON crm_invoices (invoice_number);
CREATE INDEX IF NOT EXISTS idx_crm_invoices_due ON crm_invoices (due_on, status);

CREATE TABLE IF NOT EXISTS crm_invoice_lines (
    id              BIGSERIAL PRIMARY KEY,
    invoice_id      BIGINT NOT NULL REFERENCES crm_invoices(id) ON DELETE CASCADE,
    product_slug    TEXT NOT NULL DEFAULT '',
    description     TEXT NOT NULL DEFAULT '',
    quantity        INT NOT NULL DEFAULT 1,
    unit_price_vnd  BIGINT NOT NULL DEFAULT 0,
    amount_vnd      BIGINT NOT NULL DEFAULT 0,
    sort_order      INT NOT NULL DEFAULT 0
);

ALTER TABLE crm_svc_payments ADD COLUMN IF NOT EXISTS invoice_id BIGINT REFERENCES crm_invoices(id);
ALTER TABLE crm_svc_payments ADD COLUMN IF NOT EXISTS payment_method TEXT NOT NULL DEFAULT '';
ALTER TABLE crm_svc_payments ADD COLUMN IF NOT EXISTS reference_code TEXT NOT NULL DEFAULT '';
