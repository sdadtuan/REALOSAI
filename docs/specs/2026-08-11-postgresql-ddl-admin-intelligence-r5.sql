-- R5 — Admin Intelligence (policy catalog, env diff, change approval, multi-entity)
-- Apply: ./scripts/apply_pg_ddl_admin_intelligence_r5.sh

BEGIN;

CREATE TABLE IF NOT EXISTS admin_policy_catalog (
    policy_id           TEXT PRIMARY KEY,
    description         TEXT NOT NULL DEFAULT '',
    enabled             BOOLEAN NOT NULL DEFAULT TRUE,
    bundle_version      TEXT NOT NULL DEFAULT '',
    rego_file           TEXT,
    updated_by          TEXT,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_env_diff_jobs (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    left_snapshot_id    BIGINT,
    right_snapshot_id   BIGINT,
    left_label          TEXT NOT NULL DEFAULT 'left',
    right_label         TEXT NOT NULL DEFAULT 'right',
    result_json         JSONB NOT NULL DEFAULT '{}'::jsonb,
    severity            TEXT NOT NULL DEFAULT 'info',
    created_by          TEXT NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_env_diff_jobs_created
    ON admin_env_diff_jobs (created_at DESC);

CREATE TABLE IF NOT EXISTS admin_ai_agent_policies (
    agent_code                  TEXT PRIMARY KEY,
    allowed_tools               JSONB NOT NULL DEFAULT '[]'::jsonb,
    spend_cap_usd_monthly       NUMERIC,
    pii_block_fields            JSONB NOT NULL DEFAULT '[]'::jsonb,
    require_human_approval      BOOLEAN NOT NULL DEFAULT FALSE,
    updated_by                  TEXT,
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_change_requests (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kind                TEXT NOT NULL DEFAULT 'permission_matrix',
    entity_key          TEXT NOT NULL,
    patch_json          JSONB NOT NULL,
    impact_json         JSONB,
    status              TEXT NOT NULL DEFAULT 'draft',
    requester_email     TEXT NOT NULL,
    approver_email      TEXT,
    approver_note       TEXT,
    applied_at          TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_change_requests_status
    ON admin_change_requests (status, created_at DESC);

CREATE TABLE IF NOT EXISTS staff_service_accounts (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                TEXT NOT NULL,
    key_prefix          TEXT NOT NULL,
    key_hash            TEXT NOT NULL,
    scoped_caps         JSONB NOT NULL DEFAULT '[]'::jsonb,
    active              BOOLEAN NOT NULL DEFAULT TRUE,
    expires_at          TIMESTAMPTZ,
    created_by          TEXT NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used_at        TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_staff_service_accounts_prefix
    ON staff_service_accounts (key_prefix)
    WHERE active IS TRUE;

CREATE TABLE IF NOT EXISTS staff_user_residency_rules (
    user_id             UUID PRIMARY KEY,
    allowed_tags        TEXT[] NOT NULL DEFAULT '{vn-only}',
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS legal_entities (
    id                  BIGSERIAL PRIMARY KEY,
    code                TEXT NOT NULL UNIQUE,
    name                TEXT NOT NULL,
    tax_id              TEXT,
    country_code        CHAR(2) NOT NULL DEFAULT 'VN',
    active              BOOLEAN NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS org_branches (
    id                  BIGSERIAL PRIMARY KEY,
    legal_entity_id     BIGINT NOT NULL REFERENCES legal_entities (id),
    code                TEXT NOT NULL,
    name                TEXT NOT NULL,
    active              BOOLEAN NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (legal_entity_id, code)
);

CREATE INDEX IF NOT EXISTS idx_org_branches_entity
    ON org_branches (legal_entity_id);

ALTER TABLE crm_departments
    ADD COLUMN IF NOT EXISTS branch_id BIGINT REFERENCES org_branches (id);

ALTER TABLE clients
    ADD COLUMN IF NOT EXISTS data_residency_tag TEXT;

COMMENT ON COLUMN clients.data_residency_tag IS 'vn-only | eu | sg | null = unrestricted';

INSERT INTO schema_migrations (version, description) VALUES
    ('2026-08-11-admin-intelligence-r5', 'R5 policy intelligence + multi-entity + change approval')
ON CONFLICT (version) DO NOTHING;

COMMIT;
