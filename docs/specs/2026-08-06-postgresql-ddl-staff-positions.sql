-- R1-S1 — staff RBAC extensions (audit + grants_customized)
-- Apply: ./scripts/apply_pg_ddl_staff_rbac_r1.sh
--
-- Note: runtime positions live in crm_positions (wave B6). Spec name staff_positions
-- is exposed as a view for forward compatibility until a full rename in R2+.

BEGIN;

ALTER TABLE crm_positions
    ADD COLUMN IF NOT EXISTS grants_customized BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN crm_positions.grants_customized IS
    'When TRUE, migrate_staff_permissions_pg skips destructive overwrite for this position.';

CREATE TABLE IF NOT EXISTS staff_permission_audit (
    id              BIGSERIAL PRIMARY KEY,
    actor_email     VARCHAR(255) NOT NULL DEFAULT '',
    position_id     INTEGER NOT NULL,
    diff_json       JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_permission_audit_position
    ON staff_permission_audit (position_id, created_at DESC);

COMMENT ON TABLE staff_permission_audit IS
    'RBAC matrix change audit — populated by Nest Admin PATCH (R1-S3).';

CREATE TABLE IF NOT EXISTS staff_permission_catalog_version (
    version         VARCHAR(64) PRIMARY KEY,
    applied_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    notes           TEXT NOT NULL DEFAULT ''
);

COMMENT ON TABLE staff_permission_catalog_version IS
    'Optional gate: track catalog/migration version applied to PG.';

CREATE OR REPLACE VIEW staff_positions AS
SELECT
    id,
    code,
    name,
    active,
    grants_customized,
    created_at,
    updated_at
FROM crm_positions;

COMMENT ON VIEW staff_positions IS
    'Spec alias for crm_positions — R1 uses crm_positions as SSoT.';

INSERT INTO schema_migrations (version, description) VALUES
    (
        '2026-08-06-staff-positions',
        'R1-S1 grants_customized + staff_permission_audit + staff_positions view'
    )
ON CONFLICT (version) DO NOTHING;

COMMIT;
