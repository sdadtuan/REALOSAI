-- RNOSAI — Lead Meeting Prep PostgreSQL DDL
-- Spec: docs/specs/lead-meeting-prep.md §12
-- Plan: LMP-P0 · AI-UC-021
-- Apply:
--   psql "$DATABASE_URL" -f docs/specs/2026-08-13-postgresql-ddl-lead-meeting-prep.sql
-- Or: ./scripts/apply_pg_ddl_lead_meeting_prep.sh (to be added)
--
-- Requires:
--   - crm_leads bridge / sqlite_lead_id mapping (existing OLTP)
--   - ai_agent_runs (optional FK — revenue-os-ai DDL)
-- Notes:
--   - One prep row per lead (UNIQUE lead_id)
--   - Worker updates status through pipeline lifecycle

BEGIN;

-- ===========================================================================
-- §1 crm_lead_meeting_prep — main prep state + result
-- ===========================================================================

CREATE TABLE IF NOT EXISTS crm_lead_meeting_prep (
    id                      BIGSERIAL PRIMARY KEY,
    lead_id                 BIGINT NOT NULL,
    status                  VARCHAR(32) NOT NULL DEFAULT 'pending'
                            CHECK (status IN (
                                'pending',
                                'running',
                                'awaiting_entity_choice',
                                'ready',
                                'failed',
                                'skipped',
                                'cancelled'
                            )),
    skip_reason             VARCHAR(64),
    input_snapshot_json     JSONB NOT NULL DEFAULT '{}'::jsonb,
    collect_json            JSONB NOT NULL DEFAULT '{}'::jsonb,
    entity_candidates_json  JSONB NOT NULL DEFAULT '[]'::jsonb,
    selected_entity_id      VARCHAR(64),
    result_json             JSONB NOT NULL DEFAULT '{}'::jsonb,
    error_message           TEXT,
    prep_version            INT NOT NULL DEFAULT 1,
    synth_version           INT NOT NULL DEFAULT 1,
    tavily_credits_used     INT NOT NULL DEFAULT 0,
    apify_runs              INT NOT NULL DEFAULT 0,
    prep_stage              VARCHAR(32) NOT NULL DEFAULT 'm1_first_strike'
                            CHECK (prep_stage IN (
                                'm1_first_strike',
                                'm2_qualify_win',
                                'm3_pre_close'
                            )),
    close_readiness_score   INT CHECK (
                                close_readiness_score IS NULL
                                OR (close_readiness_score >= 0 AND close_readiness_score <= 100)
                            ),
    win_outcome_json        JSONB NOT NULL DEFAULT '{}'::jsonb,
    ai_agent_run_id         UUID,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT crm_lead_meeting_prep_lead_unique UNIQUE (lead_id)
);

CREATE INDEX IF NOT EXISTS idx_crm_lead_meeting_prep_status
    ON crm_lead_meeting_prep (status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_crm_lead_meeting_prep_updated
    ON crm_lead_meeting_prep (updated_at DESC);

COMMENT ON TABLE crm_lead_meeting_prep IS
    'Lead Meeting Prep — async company research + DV recommendation + consult script per lead (AI-UC-021).';
COMMENT ON COLUMN crm_lead_meeting_prep.input_snapshot_json IS
    'Resolved PrepInput + sources_map at enqueue time.';
COMMENT ON COLUMN crm_lead_meeting_prep.collect_json IS
    'Raw Tavily/Apify collect output for debug and synthesize-only rerun.';
COMMENT ON COLUMN crm_lead_meeting_prep.entity_candidates_json IS
    'EntityCandidate[] when status=awaiting_entity_choice.';
COMMENT ON COLUMN crm_lead_meeting_prep.result_json IS
    'LeadMeetingPrepResult + close_intelligence — see docs/specs/lead-meeting-prep.md §8.1 §23';
COMMENT ON COLUMN crm_lead_meeting_prep.prep_stage IS
    'M1 first strike | M2 qualify win | M3 pre-close — see spec §22';
COMMENT ON COLUMN crm_lead_meeting_prep.close_readiness_score IS
    '0-100 sales close readiness — separate from score_lead routing score';
COMMENT ON COLUMN crm_lead_meeting_prep.win_outcome_json IS
    'P3 win/loss learn loop — actual tier closed, objections faced, AM feedback';

-- Optional FK to ai_agent_runs (when revenue-os-ai DDL applied)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'ai_agent_runs'
    ) THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints
            WHERE constraint_name = 'crm_lead_meeting_prep_ai_run_fk'
        ) THEN
            ALTER TABLE crm_lead_meeting_prep
                ADD CONSTRAINT crm_lead_meeting_prep_ai_run_fk
                FOREIGN KEY (ai_agent_run_id) REFERENCES ai_agent_runs (id) ON DELETE SET NULL;
        END IF;
    END IF;
END $$;

-- ===========================================================================
-- §2 crm_lead_meeting_prep_feedback — AM feedback (P1)
-- ===========================================================================

CREATE TABLE IF NOT EXISTS crm_lead_meeting_prep_feedback (
    id                  BIGSERIAL PRIMARY KEY,
    lead_id             BIGINT NOT NULL,
    prep_id             BIGINT NOT NULL
                        REFERENCES crm_lead_meeting_prep (id) ON DELETE CASCADE,
    helpful             BOOLEAN NOT NULL,
    service_dv_code     VARCHAR(8),
    notes               TEXT,
    actor_email         VARCHAR(120) NOT NULL DEFAULT '',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_lead_meeting_prep_feedback_lead
    ON crm_lead_meeting_prep_feedback (lead_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_crm_lead_meeting_prep_feedback_prep
    ON crm_lead_meeting_prep_feedback (prep_id, created_at DESC);

COMMENT ON TABLE crm_lead_meeting_prep_feedback IS
    'AM thumbs up/down on prep quality and per-DV recommendation (LMP P1).';

-- ===========================================================================
-- §3 crm_lead_meeting_prep_domain_cache — cost control (P2)
-- ===========================================================================

CREATE TABLE IF NOT EXISTS crm_lead_meeting_prep_domain_cache (
    id                  BIGSERIAL PRIMARY KEY,
    domain              VARCHAR(255) NOT NULL,
    collect_json        JSONB NOT NULL DEFAULT '{}'::jsonb,
    expires_at          TIMESTAMPTZ NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT crm_lead_meeting_prep_domain_cache_unique UNIQUE (domain)
);

CREATE INDEX IF NOT EXISTS idx_crm_lead_meeting_prep_domain_cache_expires
    ON crm_lead_meeting_prep_domain_cache (expires_at);

COMMENT ON TABLE crm_lead_meeting_prep_domain_cache IS
    'Optional Tavily collect cache keyed by verified domain — LMP P2 cost control.';

COMMIT;
