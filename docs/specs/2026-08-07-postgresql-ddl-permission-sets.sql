-- R2-B — Permission Sets (WIN-3-A)
-- Apply: ./scripts/apply_pg_ddl_permission_sets_r2_b.sh

CREATE TABLE IF NOT EXISTS staff_permission_sets (
    id          SERIAL PRIMARY KEY,
    code        VARCHAR(64) NOT NULL,
    name        VARCHAR(255) NOT NULL DEFAULT '',
    active      BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT staff_permission_sets_code_unique UNIQUE (code)
);

CREATE TABLE IF NOT EXISTS staff_permission_set_grants (
    set_id      INTEGER NOT NULL REFERENCES staff_permission_sets(id) ON DELETE CASCADE,
    section_id  VARCHAR(64) NOT NULL,
    action      VARCHAR(32) NOT NULL,
    PRIMARY KEY (set_id, section_id, action)
);

CREATE TABLE IF NOT EXISTS staff_user_permission_sets (
    user_id     UUID NOT NULL REFERENCES staff_users(id) ON DELETE CASCADE,
    set_id      INTEGER NOT NULL REFERENCES staff_permission_sets(id) ON DELETE CASCADE,
    granted_by  VARCHAR(255) NOT NULL DEFAULT '',
    granted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, set_id)
);

CREATE INDEX IF NOT EXISTS idx_staff_permission_set_grants_set
    ON staff_permission_set_grants(set_id);

CREATE INDEX IF NOT EXISTS idx_staff_user_permission_sets_user
    ON staff_user_permission_sets(user_id);

CREATE INDEX IF NOT EXISTS idx_staff_user_permission_sets_set
    ON staff_user_permission_sets(set_id);
