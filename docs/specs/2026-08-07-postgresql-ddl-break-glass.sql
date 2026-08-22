-- R2-D — Break-glass grants (WIN-3-B)
-- Apply: ./scripts/apply_pg_ddl_break_glass_r2_d.sh

CREATE TABLE IF NOT EXISTS staff_break_glass_grants (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID NOT NULL REFERENCES staff_users(id) ON DELETE CASCADE,
    caps_json     JSONB NOT NULL DEFAULT '[]'::jsonb,
    reason        TEXT NOT NULL DEFAULT '',
    status        VARCHAR(16) NOT NULL DEFAULT 'pending',
    requested_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    approved_by   VARCHAR(255) NOT NULL DEFAULT '',
    approved_at   TIMESTAMPTZ,
    expires_at    TIMESTAMPTZ,
    revoked_at    TIMESTAMPTZ,
    revoked_by    VARCHAR(255) NOT NULL DEFAULT '',
    CONSTRAINT staff_break_glass_status_chk
        CHECK (status IN ('pending', 'approved', 'rejected', 'revoked', 'expired'))
);

CREATE INDEX IF NOT EXISTS idx_staff_break_glass_user_active
    ON staff_break_glass_grants(user_id, status)
    WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS staff_rbac_audit_log (
    id               BIGSERIAL PRIMARY KEY,
    event_type       VARCHAR(64) NOT NULL,
    actor_email      VARCHAR(255) NOT NULL DEFAULT '',
    subject_user_id  UUID,
    section_id       VARCHAR(64) NOT NULL DEFAULT '',
    action           VARCHAR(32) NOT NULL DEFAULT '',
    metadata_json    JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_rbac_audit_log_created
    ON staff_rbac_audit_log(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_staff_rbac_audit_log_event
    ON staff_rbac_audit_log(event_type, created_at DESC);
