-- RNOSAI — CRM catalog (services + industries) on PostgreSQL
-- Replaces SQLite ptt.db catalog tables for Nest /api/crm/catalog
-- Apply: ./scripts/apply_pg_ddl_crm_catalog.sh

BEGIN;

CREATE TABLE IF NOT EXISTS crm_catalog_services (
    id              SERIAL PRIMARY KEY,
    slug            VARCHAR(80) NOT NULL UNIQUE,
    name            VARCHAR(200) NOT NULL DEFAULT '',
    description     VARCHAR(500) NOT NULL DEFAULT '',
    sort_order      INT NOT NULL DEFAULT 0,
    active          BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_catalog_services_active
    ON crm_catalog_services (active, sort_order);

CREATE TABLE IF NOT EXISTS crm_catalog_industries (
    id              SERIAL PRIMARY KEY,
    slug            VARCHAR(80) NOT NULL UNIQUE,
    name            VARCHAR(200) NOT NULL DEFAULT '',
    description     VARCHAR(500) NOT NULL DEFAULT '',
    traits_json     JSONB NOT NULL DEFAULT '{}'::jsonb,
    sort_order      INT NOT NULL DEFAULT 0,
    active          BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_catalog_industries_active
    ON crm_catalog_industries (active, sort_order);

CREATE TABLE IF NOT EXISTS crm_staff_assign_scope (
    id              SERIAL PRIMARY KEY,
    staff_id        INT NOT NULL,
    industry_slug   VARCHAR(80) NOT NULL DEFAULT '*',
    service_slug    VARCHAR(80) NOT NULL DEFAULT '*',
    active          BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (staff_id, industry_slug, service_slug)
);

CREATE INDEX IF NOT EXISTS idx_crm_staff_assign_scope_staff
    ON crm_staff_assign_scope (staff_id, active);

INSERT INTO schema_migrations (version, description)
VALUES ('2026-08-02-crm-catalog', 'crm_catalog_services + crm_catalog_industries (PG-primary)')
ON CONFLICT (version) DO NOTHING;

COMMIT;
