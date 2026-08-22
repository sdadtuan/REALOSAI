-- Wave B6 — Finance / KPI / Staff roster / svc-finance payments (PG OLTP)
BEGIN;

-- ---------------------------------------------------------------------------
-- crm_svc_payments + crm_svc_expenses
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS crm_svc_payments (
    id                      BIGSERIAL PRIMARY KEY,
    sqlite_payment_id       BIGINT UNIQUE,
    lifecycle_id            BIGINT NOT NULL,
    amount_vnd              BIGINT NOT NULL DEFAULT 0,
    received_on             DATE NOT NULL DEFAULT CURRENT_DATE,
    due_on                  DATE,
    status                  TEXT NOT NULL DEFAULT 'pending',
    notes                   TEXT NOT NULL DEFAULT '',
    invoice_id              BIGINT,
    payment_method          TEXT NOT NULL DEFAULT '',
    reference_code          TEXT NOT NULL DEFAULT '',
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_svc_payments_lifecycle
    ON crm_svc_payments (lifecycle_id, received_on DESC);

CREATE INDEX IF NOT EXISTS idx_crm_svc_payments_status_due
    ON crm_svc_payments (status, due_on);

CREATE TABLE IF NOT EXISTS crm_svc_expenses (
    id                      BIGSERIAL PRIMARY KEY,
    sqlite_expense_id       BIGINT UNIQUE,
    lifecycle_id            BIGINT NOT NULL,
    lead_id                 BIGINT,
    presales_id             BIGINT,
    title                   TEXT NOT NULL DEFAULT '',
    category                TEXT NOT NULL DEFAULT 'khac',
    amount_vnd              BIGINT NOT NULL DEFAULT 0,
    expense_on              DATE NOT NULL DEFAULT CURRENT_DATE,
    notes                   TEXT NOT NULL DEFAULT '',
    cost_phase              TEXT NOT NULL DEFAULT 'delivery',
    lifecycle_stage         TEXT NOT NULL DEFAULT '',
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_svc_expenses_lifecycle
    ON crm_svc_expenses (lifecycle_id, expense_on DESC);

CREATE INDEX IF NOT EXISTS idx_crm_svc_expenses_presales
    ON crm_svc_expenses (presales_id, cost_phase);

-- ---------------------------------------------------------------------------
-- crm_staff roster + settings
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS crm_departments (
    id                      BIGSERIAL PRIMARY KEY,
    sqlite_dept_id          BIGINT UNIQUE,
    code                    TEXT NOT NULL DEFAULT '',
    name                    TEXT NOT NULL DEFAULT '',
    active                  BOOLEAN NOT NULL DEFAULT TRUE,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS crm_positions (
    id                      BIGSERIAL PRIMARY KEY,
    sqlite_position_id      BIGINT UNIQUE,
    code                    TEXT NOT NULL DEFAULT '',
    name                    TEXT NOT NULL DEFAULT '',
    active                  BOOLEAN NOT NULL DEFAULT TRUE,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS crm_staff (
    id                      BIGSERIAL PRIMARY KEY,
    sqlite_staff_id         BIGINT UNIQUE,
    name                    TEXT NOT NULL DEFAULT '',
    phone                   TEXT NOT NULL DEFAULT '',
    email                   TEXT NOT NULL DEFAULT '',
    job_title               TEXT NOT NULL DEFAULT '',
    department              TEXT NOT NULL DEFAULT '',
    internal_code           TEXT NOT NULL DEFAULT '',
    active                  BOOLEAN NOT NULL DEFAULT TRUE,
    notes                   TEXT NOT NULL DEFAULT '',
    sort_order              INTEGER NOT NULL DEFAULT 0,
    department_id           BIGINT REFERENCES crm_departments (id) ON DELETE SET NULL,
    position_id             BIGINT REFERENCES crm_positions (id) ON DELETE SET NULL,
    reports_to_id           BIGINT REFERENCES crm_staff (id) ON DELETE SET NULL,
    employment_type         TEXT NOT NULL DEFAULT '',
    started_on              DATE,
    ended_on                DATE,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_staff_active
    ON crm_staff (active, sort_order, name);

CREATE UNIQUE INDEX IF NOT EXISTS idx_crm_staff_internal_code_nn
    ON crm_staff (lower(trim(internal_code)))
    WHERE trim(internal_code) <> '';

CREATE TABLE IF NOT EXISTS crm_staff_settings (
    config_key              TEXT PRIMARY KEY,
    config_json             JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by              TEXT NOT NULL DEFAULT ''
);

INSERT INTO crm_staff_settings (config_key, config_json)
VALUES ('global', '{"staff_levels":[],"competency":{}}'::jsonb)
ON CONFLICT (config_key) DO NOTHING;

-- ---------------------------------------------------------------------------
-- KPI metrics
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS crm_kpi_metrics (
    id                      BIGSERIAL PRIMARY KEY,
    sqlite_metric_id        BIGINT UNIQUE,
    code                    TEXT NOT NULL DEFAULT '',
    name                    TEXT NOT NULL DEFAULT '',
    unit                    TEXT NOT NULL DEFAULT '',
    description             TEXT NOT NULL DEFAULT '',
    sort_order              INTEGER NOT NULL DEFAULT 0,
    active                  BOOLEAN NOT NULL DEFAULT TRUE,
    higher_is_better        BOOLEAN NOT NULL DEFAULT TRUE,
    warn_ratio              NUMERIC(8, 4),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_kpi_metrics_active
    ON crm_kpi_metrics (active, sort_order, name);

CREATE TABLE IF NOT EXISTS crm_staff_kpi (
    id                      BIGSERIAL PRIMARY KEY,
    sqlite_staff_kpi_id     BIGINT UNIQUE,
    staff_id                BIGINT NOT NULL REFERENCES crm_staff (id) ON DELETE CASCADE,
    metric_id               BIGINT NOT NULL REFERENCES crm_kpi_metrics (id) ON DELETE CASCADE,
    year                    INTEGER NOT NULL,
    month                   INTEGER NOT NULL,
    target_value            NUMERIC(18, 4),
    actual_value            NUMERIC(18, 4),
    status                  TEXT NOT NULL DEFAULT 'on_track',
    notes                   TEXT NOT NULL DEFAULT '',
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (staff_id, metric_id, year, month)
);

CREATE INDEX IF NOT EXISTS idx_crm_staff_kpi_period
    ON crm_staff_kpi (year, month, staff_id);

-- ---------------------------------------------------------------------------
-- Finance config tables
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS crm_finance_period_inputs (
    year                    INTEGER NOT NULL,
    month                   INTEGER NOT NULL,
    marketing_spend_vnd     BIGINT NOT NULL DEFAULT 0,
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (year, month)
);

CREATE TABLE IF NOT EXISTS crm_finance_kpi_config (
    config_key              TEXT PRIMARY KEY DEFAULT 'global',
    thresholds_json         JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO crm_finance_kpi_config (config_key, thresholds_json)
VALUES ('global', '{}'::jsonb)
ON CONFLICT (config_key) DO NOTHING;

-- Bridge SOP tables (crm_sop_* views over sop_* from v4 DDL when present)
CREATE TABLE IF NOT EXISTS crm_sop_templates (
    id                      BIGSERIAL PRIMARY KEY,
    sqlite_template_id      BIGINT UNIQUE,
    code                    TEXT NOT NULL DEFAULT '',
    name                    TEXT NOT NULL DEFAULT '',
    channel                 TEXT NOT NULL DEFAULT 'other',
    description             TEXT NOT NULL DEFAULT '',
    notes                   TEXT NOT NULL DEFAULT '',
    active                  BOOLEAN NOT NULL DEFAULT TRUE,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS crm_sop_steps (
    id                      BIGSERIAL PRIMARY KEY,
    sqlite_step_id          BIGINT UNIQUE,
    template_id             BIGINT NOT NULL REFERENCES crm_sop_templates (id) ON DELETE CASCADE,
    position                INTEGER NOT NULL DEFAULT 0,
    title                   TEXT NOT NULL DEFAULT '',
    description             TEXT NOT NULL DEFAULT '',
    offset_days             INTEGER NOT NULL DEFAULT 0,
    duration_days           INTEGER NOT NULL DEFAULT 1,
    role                    TEXT NOT NULL DEFAULT 'any',
    required                BOOLEAN NOT NULL DEFAULT TRUE,
    checklist_json          JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_sop_steps_template
    ON crm_sop_steps (template_id, position);

CREATE TABLE IF NOT EXISTS crm_sop_runs (
    id                      BIGSERIAL PRIMARY KEY,
    sqlite_run_id           BIGINT UNIQUE,
    campaign_id             BIGINT,
    template_id             BIGINT REFERENCES crm_sop_templates (id) ON DELETE SET NULL,
    name                    TEXT NOT NULL DEFAULT '',
    status                  TEXT NOT NULL DEFAULT 'active',
    start_date              DATE,
    notes                   TEXT NOT NULL DEFAULT '',
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_sop_runs_status
    ON crm_sop_runs (status, start_date);

CREATE TABLE IF NOT EXISTS crm_sop_run_tasks (
    id                      BIGSERIAL PRIMARY KEY,
    sqlite_task_id          BIGINT UNIQUE,
    run_id                  BIGINT NOT NULL REFERENCES crm_sop_runs (id) ON DELETE CASCADE,
    step_id                 BIGINT REFERENCES crm_sop_steps (id) ON DELETE SET NULL,
    position                INTEGER NOT NULL DEFAULT 0,
    title                   TEXT NOT NULL DEFAULT '',
    description             TEXT NOT NULL DEFAULT '',
    role                    TEXT NOT NULL DEFAULT 'any',
    due_date                DATE,
    status                  TEXT NOT NULL DEFAULT 'todo',
    notes                   TEXT NOT NULL DEFAULT '',
    checklist_json          JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_sop_run_tasks_run
    ON crm_sop_run_tasks (run_id, position);

INSERT INTO ptt_schema_migrations (id, notes)
VALUES ('2026-08-02-wave-b6-finance-kpi-staff-sop', 'svc-finance + staff roster + KPI + finance config + crm_sop_*')
ON CONFLICT (id) DO NOTHING;

COMMIT;
