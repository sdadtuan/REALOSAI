-- R3 — Admin Audit & Compliance Center
-- Apply: ./scripts/apply_pg_ddl_admin_audit_r3.sh

BEGIN;

CREATE INDEX IF NOT EXISTS idx_staff_permission_audit_created
    ON staff_permission_audit (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_staff_org_audit_created
    ON staff_org_audit (created_at DESC);

CREATE TABLE IF NOT EXISTS staff_pii_access_log (
    id              BIGSERIAL PRIMARY KEY,
    actor_email     VARCHAR(255) NOT NULL DEFAULT '',
    actor_user_id   UUID,
    resource_type   VARCHAR(32) NOT NULL,
    resource_id     VARCHAR(64) NOT NULL,
    field_path      VARCHAR(128) NOT NULL,
    action          VARCHAR(16) NOT NULL DEFAULT 'view',
    request_path    VARCHAR(512) NOT NULL DEFAULT '',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_pii_access_created
    ON staff_pii_access_log (created_at DESC);

CREATE TABLE IF NOT EXISTS admin_audit_log (
    id              BIGSERIAL PRIMARY KEY,
    event_type      VARCHAR(64) NOT NULL,
    actor_email     VARCHAR(255) NOT NULL DEFAULT '',
    category        VARCHAR(32) NOT NULL DEFAULT 'config_snapshot',
    severity        VARCHAR(16) NOT NULL DEFAULT 'info',
    subject_label   VARCHAR(255) NOT NULL DEFAULT '',
    subject_id      VARCHAR(64) NOT NULL DEFAULT '',
    action          VARCHAR(64) NOT NULL DEFAULT '',
    summary         TEXT NOT NULL DEFAULT '',
    diff_json       JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created
    ON admin_audit_log (created_at DESC);

CREATE TABLE IF NOT EXISTS admin_audit_export_jobs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requested_by    VARCHAR(255) NOT NULL,
    format          VARCHAR(8) NOT NULL CHECK (format IN ('csv', 'json')),
    filters_json    JSONB NOT NULL DEFAULT '{}',
    status          VARCHAR(16) NOT NULL DEFAULT 'queued',
    row_count       INT,
    file_path       TEXT,
    error_message   TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at    TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS admin_config_snapshots (
    id              BIGSERIAL PRIMARY KEY,
    snapshot_type   VARCHAR(32) NOT NULL,
    entity_key      VARCHAR(64) NOT NULL,
    payload_json    JSONB NOT NULL,
    signed_by       VARCHAR(255) NOT NULL,
    signed_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    note            TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_admin_config_snapshots_entity
    ON admin_config_snapshots (snapshot_type, entity_key, signed_at DESC);

COMMENT ON TABLE staff_pii_access_log IS 'R3 — field-level PII access audit (prep ABAC).';
COMMENT ON TABLE admin_audit_log IS 'R3 — synthetic admin audit events (drift, snapshots).';

INSERT INTO schema_migrations (version, description) VALUES
    ('2026-08-11-admin-audit-r3', 'R3 Admin Audit Center tables + indexes')
ON CONFLICT (version) DO NOTHING;

COMMIT;
