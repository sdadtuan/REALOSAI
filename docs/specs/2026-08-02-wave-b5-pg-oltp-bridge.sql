-- Wave B5 — Intake BANT + Contract promote / lifecycle PG OLTP bridge
-- Apply AFTER Wave B4 funnel DDL:
--   ./scripts/apply_pg_ddl_wave_b5_oltp.sh
--
-- Enables PTT_CRM_INTAKE_PG=1 and PTT_CRM_CONTRACT_PG=1 (default on with funnel PG).

BEGIN;

-- ---------------------------------------------------------------------------
-- crm_leads — conversion + intake sync columns
-- ---------------------------------------------------------------------------

ALTER TABLE crm_leads
    ADD COLUMN IF NOT EXISTS need TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS converted_customer_id BIGINT,
    ADD COLUMN IF NOT EXISTS converted_case_id BIGINT;

-- ---------------------------------------------------------------------------
-- crm_customers
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS crm_customers (
    id                      BIGSERIAL PRIMARY KEY,
    sqlite_customer_id      BIGINT UNIQUE,
    name                    TEXT NOT NULL DEFAULT '',
    phone                   TEXT NOT NULL DEFAULT '',
    email                   TEXT NOT NULL DEFAULT '',
    address                 TEXT NOT NULL DEFAULT '',
    company                 TEXT NOT NULL DEFAULT '',
    is_placeholder          BOOLEAN NOT NULL DEFAULT FALSE,
    placeholder_lead_id     BIGINT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_customers_phone
    ON crm_customers (phone)
    WHERE phone <> '' AND is_placeholder IS NOT TRUE;

CREATE INDEX IF NOT EXISTS idx_crm_customers_placeholder_lead
    ON crm_customers (placeholder_lead_id)
    WHERE is_placeholder IS TRUE;

-- ---------------------------------------------------------------------------
-- crm_cases
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS crm_cases (
    id                      BIGSERIAL PRIMARY KEY,
    sqlite_case_id          BIGINT UNIQUE,
    customer_id             BIGINT NOT NULL REFERENCES crm_customers (id) ON DELETE CASCADE,
    title                   TEXT NOT NULL DEFAULT '',
    description             TEXT NOT NULL DEFAULT '',
    channel                 TEXT NOT NULL DEFAULT 'khac',
    priority                TEXT NOT NULL DEFAULT 'binh_thuong',
    status                  TEXT NOT NULL DEFAULT 'moi',
    assigned_to             TEXT NOT NULL DEFAULT '',
    assigned_staff_id       BIGINT,
    assigned_at             TIMESTAMPTZ,
    pipeline_stage          TEXT NOT NULL DEFAULT 'moi',
    stage_entered_at        TIMESTAMPTZ,
    lead_source             TEXT NOT NULL DEFAULT '',
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_cases_customer ON crm_cases (customer_id);

-- ---------------------------------------------------------------------------
-- crm_contracts
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS crm_contracts (
    id                      BIGSERIAL PRIMARY KEY,
    sqlite_contract_id      BIGINT UNIQUE,
    customer_id             BIGINT NOT NULL REFERENCES crm_customers (id),
    case_id                 BIGINT REFERENCES crm_cases (id) ON DELETE SET NULL,
    campaign_id             BIGINT,
    reference_code          TEXT NOT NULL DEFAULT '',
    title                   TEXT NOT NULL DEFAULT '',
    status                  TEXT NOT NULL DEFAULT 'draft',
    signed_on               DATE,
    starts_on               DATE,
    ends_on                 DATE,
    amount_vnd              BIGINT NOT NULL DEFAULT 0,
    renewal_reminder_days   INTEGER NOT NULL DEFAULT 30,
    notes                   TEXT NOT NULL DEFAULT '',
    lead_id                 BIGINT,
    service_slug            TEXT NOT NULL DEFAULT '',
    agency_client_id        TEXT NOT NULL DEFAULT '',
    billing_type            TEXT NOT NULL DEFAULT 'one_off',
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT crm_contracts_lead_fk FOREIGN KEY (lead_id)
        REFERENCES crm_leads (sqlite_lead_id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_crm_contracts_lead ON crm_contracts (lead_id);
CREATE INDEX IF NOT EXISTS idx_crm_contracts_agency_client ON crm_contracts (agency_client_id);

-- ---------------------------------------------------------------------------
-- crm_contract_approvals + events
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS crm_contract_approvals (
    id                      BIGSERIAL PRIMARY KEY,
    sqlite_approval_id      BIGINT UNIQUE,
    contract_id             BIGINT NOT NULL REFERENCES crm_contracts (id) ON DELETE CASCADE,
    lead_id                 BIGINT NOT NULL,
    status                  TEXT NOT NULL DEFAULT 'pending',
    requested_by            TEXT NOT NULL DEFAULT '',
    decided_by              TEXT NOT NULL DEFAULT '',
    amount_vnd              BIGINT NOT NULL DEFAULT 0,
    notes                   TEXT NOT NULL DEFAULT '',
    decision_notes          TEXT NOT NULL DEFAULT '',
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    decided_at              TIMESTAMPTZ,
    CONSTRAINT crm_contract_approvals_lead_fk FOREIGN KEY (lead_id)
        REFERENCES crm_leads (sqlite_lead_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_crm_contract_approvals_pending
    ON crm_contract_approvals (status, created_at)
    WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS crm_contract_events (
    id                      BIGSERIAL PRIMARY KEY,
    sqlite_event_id         BIGINT UNIQUE,
    contract_id             BIGINT NOT NULL REFERENCES crm_contracts (id) ON DELETE CASCADE,
    event_type              TEXT NOT NULL DEFAULT '',
    actor                   TEXT NOT NULL DEFAULT '',
    payload_json            JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_contract_events_contract
    ON crm_contract_events (contract_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- crm_service_lifecycle
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS crm_service_lifecycle (
    id                      BIGSERIAL PRIMARY KEY,
    sqlite_lifecycle_id     BIGINT UNIQUE,
    lead_id                 BIGINT,
    customer_id             BIGINT REFERENCES crm_customers (id) ON DELETE SET NULL,
    contract_id             BIGINT REFERENCES crm_contracts (id) ON DELETE SET NULL,
    service_slug            TEXT NOT NULL DEFAULT '',
    stage                   TEXT NOT NULL DEFAULT 'lead',
    status                  TEXT NOT NULL DEFAULT 'draft',
    assigned_am             BIGINT,
    assigned_sp             BIGINT,
    stage_entered_at        TIMESTAMPTZ,
    notes                   TEXT NOT NULL DEFAULT '',
    marketing_plan_id       BIGINT,
    sop_run_id              BIGINT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT crm_service_lifecycle_lead_fk FOREIGN KEY (lead_id)
        REFERENCES crm_leads (sqlite_lead_id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_crm_service_lifecycle_lead ON crm_service_lifecycle (lead_id);
CREATE INDEX IF NOT EXISTS idx_crm_service_lifecycle_contract ON crm_service_lifecycle (contract_id);

CREATE TABLE IF NOT EXISTS crm_service_lifecycle_events (
    id                      BIGSERIAL PRIMARY KEY,
    sqlite_event_id         BIGINT UNIQUE,
    lifecycle_id            BIGINT NOT NULL REFERENCES crm_service_lifecycle (id) ON DELETE CASCADE,
    from_stage              TEXT,
    to_stage                TEXT NOT NULL,
    actor_id                BIGINT,
    actor_type              TEXT NOT NULL DEFAULT 'human',
    notes                   TEXT NOT NULL DEFAULT '',
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_service_lifecycle_events_lc
    ON crm_service_lifecycle_events (lifecycle_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- crm_svc_tasks
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS crm_svc_tasks (
    id                      BIGSERIAL PRIMARY KEY,
    sqlite_task_id          BIGINT UNIQUE,
    lifecycle_id            BIGINT NOT NULL REFERENCES crm_service_lifecycle (id) ON DELETE CASCADE,
    stage                   TEXT NOT NULL DEFAULT '',
    step_index              INTEGER NOT NULL DEFAULT 0,
    title                   TEXT NOT NULL DEFAULT '',
    description             TEXT NOT NULL DEFAULT '',
    form_fields             JSONB NOT NULL DEFAULT '[]'::jsonb,
    form_data               JSONB NOT NULL DEFAULT '{}'::jsonb,
    ai_output               TEXT NOT NULL DEFAULT '',
    ai_prompt_key           TEXT NOT NULL DEFAULT '',
    is_done                 BOOLEAN NOT NULL DEFAULT FALSE,
    done_at                 TIMESTAMPTZ,
    done_by                 BIGINT,
    notes                   TEXT NOT NULL DEFAULT '',
    is_custom               BOOLEAN NOT NULL DEFAULT FALSE,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_svc_tasks_lifecycle
    ON crm_svc_tasks (lifecycle_id, stage, step_index);

-- ---------------------------------------------------------------------------
-- crm_lead_intake_sessions — BANT / consult gate
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS crm_lead_intake_sessions (
    id                      BIGSERIAL PRIMARY KEY,
    sqlite_intake_id        BIGINT UNIQUE,
    lead_id                 BIGINT,
    lifecycle_id            BIGINT REFERENCES crm_service_lifecycle (id) ON DELETE CASCADE,
    service_slug            TEXT NOT NULL DEFAULT '',
    mode                    TEXT NOT NULL DEFAULT 'phone',
    status                  TEXT NOT NULL DEFAULT 'draft',
    am_id                   BIGINT,
    contact_name            TEXT NOT NULL DEFAULT '',
    contact_role            TEXT NOT NULL DEFAULT '',
    company_name            TEXT NOT NULL DEFAULT '',
    source                  TEXT NOT NULL DEFAULT '',
    bant_json               JSONB NOT NULL DEFAULT '{}'::jsonb,
    bant_total              INTEGER NOT NULL DEFAULT 0,
    lead_temperature        TEXT NOT NULL DEFAULT '',
    decision                TEXT NOT NULL DEFAULT '',
    decision_reason         TEXT NOT NULL DEFAULT '',
    answers_json            JSONB NOT NULL DEFAULT '{}'::jsonb,
    stakeholders_json       JSONB NOT NULL DEFAULT '[]'::jsonb,
    commitments_json        JSONB NOT NULL DEFAULT '[]'::jsonb,
    next_meeting_at         TEXT NOT NULL DEFAULT '',
    next_meeting_note       TEXT NOT NULL DEFAULT '',
    proposal_date           TEXT NOT NULL DEFAULT '',
    ai_summary              TEXT NOT NULL DEFAULT '',
    ai_suggested_questions  JSONB NOT NULL DEFAULT '[]'::jsonb,
    started_at              TIMESTAMPTZ,
    completed_at            TIMESTAMPTZ,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT crm_lead_intake_sessions_lead_fk FOREIGN KEY (lead_id)
        REFERENCES crm_leads (sqlite_lead_id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_crm_lead_intake_lifecycle
    ON crm_lead_intake_sessions (lifecycle_id, status);

CREATE INDEX IF NOT EXISTS idx_crm_lead_intake_lead
    ON crm_lead_intake_sessions (lead_id, mode);

-- ---------------------------------------------------------------------------
-- Schema version marker
-- ---------------------------------------------------------------------------

INSERT INTO ptt_schema_migrations (id, notes)
VALUES (
    '2026-08-02-wave-b5-oltp',
    'intake sessions + contract promote + lifecycle/customer PG OLTP'
)
ON CONFLICT (id) DO NOTHING;

COMMIT;
