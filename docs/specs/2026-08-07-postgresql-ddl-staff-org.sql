-- R2-HR — Staff org tables (WIN-2-A)
-- Apply: ./scripts/apply_pg_ddl_staff_org_r2_hr.sh

ALTER TABLE crm_departments
    ADD COLUMN IF NOT EXISTS parent_id BIGINT REFERENCES crm_departments (id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_crm_departments_code_nn
    ON crm_departments (lower(trim(code)))
    WHERE trim(code) <> '';

CREATE TABLE IF NOT EXISTS staff_teams (
    id              BIGSERIAL PRIMARY KEY,
    code            TEXT NOT NULL,
    name            TEXT NOT NULL DEFAULT '',
    department_id   BIGINT REFERENCES crm_departments (id) ON DELETE SET NULL,
    active          BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_staff_teams_code_nn
    ON staff_teams (lower(trim(code)))
    WHERE trim(code) <> '';

CREATE INDEX IF NOT EXISTS idx_staff_teams_department
    ON staff_teams (department_id, active);

CREATE TABLE IF NOT EXISTS staff_user_teams (
    user_id     UUID NOT NULL REFERENCES staff_users (id) ON DELETE CASCADE,
    team_id     BIGINT NOT NULL REFERENCES staff_teams (id) ON DELETE CASCADE,
    team_role   VARCHAR(32) NOT NULL DEFAULT 'member',
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, team_id)
);

CREATE INDEX IF NOT EXISTS idx_staff_user_teams_team
    ON staff_user_teams (team_id);

ALTER TABLE crm_positions
    ADD COLUMN IF NOT EXISTS parent_id BIGINT REFERENCES crm_positions (id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS department_id BIGINT REFERENCES crm_departments (id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS staff_org_audit (
    id              BIGSERIAL PRIMARY KEY,
    actor_email     VARCHAR(255) NOT NULL DEFAULT '',
    entity_type     VARCHAR(32) NOT NULL,
    entity_id       VARCHAR(64) NOT NULL,
    action          VARCHAR(32) NOT NULL,
    diff_json       JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_org_audit_entity
    ON staff_org_audit (entity_type, entity_id, created_at DESC);
