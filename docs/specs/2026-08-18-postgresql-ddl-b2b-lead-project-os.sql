BEGIN;

CREATE TABLE IF NOT EXISTS crm_operating_company (
    id          UUID PRIMARY KEY,
    code        VARCHAR(32) NOT NULL UNIQUE,
    name        VARCHAR(255) NOT NULL,
    status      VARCHAR(16) NOT NULL DEFAULT 'active',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO crm_operating_company (id, code, name)
VALUES ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'PTT', 'PTT')
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS crm_b2b_projects (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_company_id        UUID NOT NULL REFERENCES crm_operating_company (id),
    code                    VARCHAR(64) NOT NULL UNIQUE,
    name                    VARCHAR(255) NOT NULL,
    status                  VARCHAR(16) NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'active', 'paused', 'archived')),
    business_hours_json     JSONB NOT NULL DEFAULT '{"tz":"Asia/Ho_Chi_Minh","days":[1,2,3,4,5],"start":"08:00","end":"18:00"}'::jsonb,
    sla_json                JSONB NOT NULL DEFAULT '{"hot":{"warnMin":3,"hopMin":5},"warm":{"warnMin":10,"hopMin":15},"cold":{"warnMin":25,"hopMin":30},"maxHops":2}'::jsonb,
    commission_json         JSONB NOT NULL DEFAULT '{"first_touch_pct":30,"closer_pct":70}'::jsonb,
    ai_call_enabled         BOOLEAN NOT NULL DEFAULT FALSE,
    manual_ingest_enabled   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO crm_b2b_projects (owner_company_id, code, name, status)
VALUES ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'PTT-LEGACY', 'PTT Legacy (backfill)', 'paused')
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS crm_b2b_project_pages (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id      UUID NOT NULL REFERENCES crm_b2b_projects (id) ON DELETE CASCADE,
    page_id         VARCHAR(64) NOT NULL,
    name            VARCHAR(255) NOT NULL DEFAULT '',
    token_ref       TEXT,
    active          BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_b2b_page_active
    ON crm_b2b_project_pages (page_id) WHERE active;

CREATE TABLE IF NOT EXISTS crm_b2b_project_page_forms (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    page_row_id     UUID NOT NULL REFERENCES crm_b2b_project_pages (id) ON DELETE CASCADE,
    form_id         VARCHAR(64) NOT NULL,
    name            VARCHAR(255) NOT NULL DEFAULT '',
    active          BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_b2b_form_active
    ON crm_b2b_project_page_forms (form_id) WHERE active;

CREATE TABLE IF NOT EXISTS crm_b2b_project_channel_accounts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id      UUID NOT NULL REFERENCES crm_b2b_projects (id) ON DELETE CASCADE,
    channel_type    VARCHAR(16) NOT NULL CHECK (channel_type IN ('zalo', 'webform', 'api')),
    external_key    VARCHAR(255) NOT NULL,
    label           VARCHAR(255) NOT NULL DEFAULT '',
    config_json     JSONB NOT NULL DEFAULT '{}'::jsonb,
    active          BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_b2b_channel_active
    ON crm_b2b_project_channel_accounts (channel_type, external_key) WHERE active;

CREATE TABLE IF NOT EXISTS crm_b2b_project_staff (
    project_id      UUID NOT NULL REFERENCES crm_b2b_projects (id) ON DELETE CASCADE,
    staff_id        BIGINT NOT NULL,
    assign_enabled  BOOLEAN NOT NULL DEFAULT FALSE,
    sales_level     VARCHAR(8) NOT NULL DEFAULT 'b',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (project_id, staff_id)
);

ALTER TABLE crm_leads
    ADD COLUMN IF NOT EXISTS owner_company_id UUID REFERENCES crm_operating_company (id),
    ADD COLUMN IF NOT EXISTS b2b_project_id UUID REFERENCES crm_b2b_projects (id),
    ADD COLUMN IF NOT EXISTS assign_strategy VARCHAR(32),
    ADD COLUMN IF NOT EXISTS assign_reason TEXT,
    ADD COLUMN IF NOT EXISTS assign_confidence NUMERIC(4, 3);

CREATE TABLE IF NOT EXISTS crm_b2b_lead_hops (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id         BIGINT NOT NULL,
    from_owner_id   BIGINT,
    to_owner_id     BIGINT,
    hop_kind        VARCHAR(24) NOT NULL,
    reason          TEXT NOT NULL DEFAULT '',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS crm_b2b_lead_commission_split (
    lead_id             BIGINT PRIMARY KEY,
    first_touch_staff_id BIGINT NOT NULL,
    closer_staff_id     BIGINT,
    first_touch_pct     INT NOT NULL DEFAULT 30,
    closer_pct          INT NOT NULL DEFAULT 70,
    split_on_contract   BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS crm_b2b_lead_alerts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id         BIGINT NOT NULL,
    staff_id        BIGINT NOT NULL,
    severity        VARCHAR(16) NOT NULL,
    kind            VARCHAR(32) NOT NULL,
    read_at         TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS crm_b2b_call_sessions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id         BIGINT NOT NULL,
    staff_id        BIGINT,
    provider        VARCHAR(32) NOT NULL DEFAULT 'mock',
    state           VARCHAR(16) NOT NULL,
    kind            VARCHAR(16) NOT NULL DEFAULT 'human',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at        TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS crm_b2b_unmatched_ingress (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel         VARCHAR(16) NOT NULL,
    project_slug    VARCHAR(64),
    external_key    VARCHAR(255) NOT NULL,
    payload_json    JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO schema_migrations (version, description) VALUES
    ('2026-08-18-b2b-lead-project-os', 'operating company, b2b projects, channels, lead columns, hops, alerts')
ON CONFLICT (version) DO NOTHING;

COMMIT;
