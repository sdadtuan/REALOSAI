-- R1.5 — Job function tables (WIN-1-C)
-- Apply: ./scripts/apply_pg_ddl_staff_job_functions_r1_5.sh

CREATE TABLE IF NOT EXISTS staff_job_functions (
    code              VARCHAR(32) PRIMARY KEY,
    label             VARCHAR(128) NOT NULL DEFAULT '',
    description       TEXT NOT NULL DEFAULT '',
    department_scope  VARCHAR(64) NOT NULL DEFAULT '',
    active            BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order        INTEGER NOT NULL DEFAULT 0,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS staff_job_function_grants (
    function_code VARCHAR(32) NOT NULL REFERENCES staff_job_functions(code) ON DELETE CASCADE,
    section_id    VARCHAR(64) NOT NULL,
    action        VARCHAR(32) NOT NULL,
    PRIMARY KEY (function_code, section_id, action)
);

CREATE TABLE IF NOT EXISTS staff_user_job_functions (
    user_id       UUID NOT NULL REFERENCES staff_users(id) ON DELETE CASCADE,
    function_code VARCHAR(32) NOT NULL REFERENCES staff_job_functions(code) ON DELETE CASCADE,
    assigned_by   VARCHAR(255) NOT NULL DEFAULT '',
    assigned_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, function_code)
);

ALTER TABLE crm_staff
    ADD COLUMN IF NOT EXISTS job_function_primary VARCHAR(32) NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_staff_user_job_functions_user
    ON staff_user_job_functions(user_id);
