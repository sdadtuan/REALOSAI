-- RNOSAI — AI Marketing Planner PostgreSQL DDL (Triển khai DV)
-- Spec: docs/specs/2026-08-08-mkt-ai-planner-integration-spec.md §16
-- Plan: MKT-AI-01 · SVC-UC-003, SVC-UC-011
-- Apply:
--   psql "$DATABASE_URL" -f docs/specs/2026-08-08-postgresql-ddl-mkt-ai-planner.sql
-- Or: ./scripts/apply_pg_ddl_mkt_ai_planner.sh
--
-- Requires:
--   - crm_service_lifecycle (wave-b5 OLTP bridge)
--   - crm_marketing_plans (optional — official TMMT target)
--   - ai_agent_runs (optional FK — revenue-os-ai DDL)
-- Notes:
--   - One brief row + one working draft per lifecycle (UNIQUE lifecycle_id)
--   - Phase 2 RAG tables included; pgvector optional (embedding_json MVP)

BEGIN;

-- ---------------------------------------------------------------------------
-- Optional: pgvector for brand KB embeddings (Phase 2+) — enable when ready
-- ---------------------------------------------------------------------------
-- CREATE EXTENSION IF NOT EXISTS vector;

-- ===========================================================================
-- §1 Phase 1 — Brief, jobs, working draft, campaigns, content
-- ===========================================================================

CREATE TABLE IF NOT EXISTS mkt_ai_briefs (
    id                      BIGSERIAL PRIMARY KEY,
    lifecycle_id            BIGINT NOT NULL
                            REFERENCES crm_service_lifecycle (id) ON DELETE CASCADE,
    brief_json              JSONB NOT NULL DEFAULT '{}'::jsonb,
    prefill_sources_json    JSONB NOT NULL DEFAULT '[]'::jsonb,
    validation_json         JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by              VARCHAR(120) NOT NULL DEFAULT '',
    updated_by              VARCHAR(120) NOT NULL DEFAULT '',
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT mkt_ai_briefs_lifecycle_unique UNIQUE (lifecycle_id)
);

CREATE INDEX IF NOT EXISTS idx_mkt_ai_briefs_lifecycle
    ON mkt_ai_briefs (lifecycle_id);

COMMENT ON TABLE mkt_ai_briefs IS
    'Structured PRD brief intake per service lifecycle (Step 1 — BriefIntakeForm).';
COMMENT ON COLUMN mkt_ai_briefs.brief_json IS
    'Fields: brand_name, industry, service_slug, objective, budget_monthly_vnd, geo_markets[], competitors[], challenges, usp, website_url, timeline_*';

CREATE TABLE IF NOT EXISTS mkt_ai_drafts (
    lifecycle_id            BIGINT PRIMARY KEY
                            REFERENCES crm_service_lifecycle (id) ON DELETE CASCADE,
    strategy_framework_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    target_market_prof_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    swot_json               JSONB NOT NULL DEFAULT '{}'::jsonb,
    campaigns_json          JSONB NOT NULL DEFAULT '[]'::jsonb,
    content_json            JSONB NOT NULL DEFAULT '{}'::jsonb,
    quality_score_json      JSONB NOT NULL DEFAULT '{}'::jsonb,
    last_applied_version_id BIGINT,
    updated_by              VARCHAR(120) NOT NULL DEFAULT '',
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE mkt_ai_drafts IS
    'Working AI draft before apply-to-TMMT; GET /ai-planner/context assembles from here + jobs.';

CREATE TABLE IF NOT EXISTS mkt_ai_jobs (
    id                      BIGSERIAL PRIMARY KEY,
    lifecycle_id            BIGINT NOT NULL
                            REFERENCES crm_service_lifecycle (id) ON DELETE CASCADE,
    job_type                VARCHAR(32) NOT NULL,
    status                  VARCHAR(16) NOT NULL DEFAULT 'pending'
                            CHECK (status IN (
                                'pending', 'running', 'succeeded', 'failed', 'cancelled'
                            )),
    prompt_version          VARCHAR(32) NOT NULL DEFAULT 'v1',
    model_name              VARCHAR(128) NOT NULL DEFAULT '',
    input_json              JSONB NOT NULL DEFAULT '{}'::jsonb,
    output_json             JSONB NOT NULL DEFAULT '{}'::jsonb,
    error_message           TEXT,
    latency_ms              INT,
    token_usage_json        JSONB NOT NULL DEFAULT '{}'::jsonb,
    ai_agent_run_id         UUID,
    actor_email             VARCHAR(120) NOT NULL DEFAULT '',
    correlation_id          VARCHAR(64),
    started_at              TIMESTAMPTZ,
    ended_at                TIMESTAMPTZ,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT mkt_ai_jobs_type_check CHECK (
        job_type IN (
            'brief_summarize',
            'strategy_generate',
            'campaign_generate',
            'content_generate',
            'quality_score',
            'apply_to_tmmt',
            'budget_simulate',
            'optimize',
            'multi_agent'
        )
    )
);

CREATE INDEX IF NOT EXISTS idx_mkt_ai_jobs_lifecycle_created
    ON mkt_ai_jobs (lifecycle_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_mkt_ai_jobs_lifecycle_status
    ON mkt_ai_jobs (lifecycle_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_mkt_ai_jobs_type_status
    ON mkt_ai_jobs (job_type, status, created_at DESC);

COMMENT ON TABLE mkt_ai_jobs IS
    'Async AI planner job queue + audit (AiJobProgressPanel). Links optionally to ai_agent_runs.';

-- Optional FK when revenue-os-ai DDL applied
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'ai_agent_runs'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'mkt_ai_jobs_ai_agent_run_fk'
    ) THEN
        ALTER TABLE mkt_ai_jobs
            ADD CONSTRAINT mkt_ai_jobs_ai_agent_run_fk
            FOREIGN KEY (ai_agent_run_id) REFERENCES ai_agent_runs (id) ON DELETE SET NULL;
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS mkt_ai_campaigns (
    id                      BIGSERIAL PRIMARY KEY,
    lifecycle_id            BIGINT NOT NULL
                            REFERENCES crm_service_lifecycle (id) ON DELETE CASCADE,
    job_id                  BIGINT REFERENCES mkt_ai_jobs (id) ON DELETE SET NULL,
    name                    TEXT NOT NULL DEFAULT '',
    objective               TEXT NOT NULL DEFAULT 'lead',
    channel_mix_json        JSONB NOT NULL DEFAULT '[]'::jsonb,
    budget_pct              NUMERIC(5, 2),
    timeline_json           JSONB NOT NULL DEFAULT '{}'::jsonb,
    milestones_json         JSONB NOT NULL DEFAULT '[]'::jsonb,
    kpis_json               JSONB NOT NULL DEFAULT '[]'::jsonb,
    notes                   TEXT NOT NULL DEFAULT '',
    sort_order              INT NOT NULL DEFAULT 0,
    is_manual               BOOLEAN NOT NULL DEFAULT FALSE,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mkt_ai_campaigns_lifecycle
    ON mkt_ai_campaigns (lifecycle_id, sort_order, id);

COMMENT ON TABLE mkt_ai_campaigns IS
    'Campaign plan rows from AI or manual add (Step 3 — AiCampaignBuilder).';

CREATE TABLE IF NOT EXISTS mkt_ai_content_assets (
    id                      BIGSERIAL PRIMARY KEY,
    lifecycle_id            BIGINT NOT NULL
                            REFERENCES crm_service_lifecycle (id) ON DELETE CASCADE,
    job_id                  BIGINT REFERENCES mkt_ai_jobs (id) ON DELETE SET NULL,
    campaign_id             BIGINT REFERENCES mkt_ai_campaigns (id) ON DELETE SET NULL,
    asset_type              VARCHAR(32) NOT NULL DEFAULT 'calendar',
    title                   TEXT NOT NULL DEFAULT '',
    body_text               TEXT NOT NULL DEFAULT '',
    content_json            JSONB NOT NULL DEFAULT '{}'::jsonb,
    scheduled_date          DATE,
    channel                 TEXT NOT NULL DEFAULT '',
    sort_order              INT NOT NULL DEFAULT 0,
    creative_id             BIGINT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT mkt_ai_content_assets_type_check CHECK (
        asset_type IN (
            'calendar', 'ad_copy', 'email_sequence', 'social_post', 'blog', 'other'
        )
    )
);

CREATE INDEX IF NOT EXISTS idx_mkt_ai_content_assets_lifecycle_date
    ON mkt_ai_content_assets (lifecycle_id, scheduled_date, sort_order);

CREATE INDEX IF NOT EXISTS idx_mkt_ai_content_assets_lifecycle_type
    ON mkt_ai_content_assets (lifecycle_id, asset_type, sort_order);

COMMENT ON TABLE mkt_ai_content_assets IS
    'Content calendar entries, ad copy variants, email sequences (Step 4).';

-- ===========================================================================
-- §2 Phase 2 — Versioning, RAG brand KB, budget, collaboration
-- ===========================================================================

CREATE TABLE IF NOT EXISTS mkt_ai_plan_versions (
    id                      BIGSERIAL PRIMARY KEY,
    lifecycle_id            BIGINT NOT NULL
                            REFERENCES crm_service_lifecycle (id) ON DELETE CASCADE,
    version_no              INT NOT NULL,
    label                   TEXT NOT NULL DEFAULT '',
    status                  VARCHAR(16) NOT NULL DEFAULT 'draft'
                            CHECK (status IN (
                                'draft', 'pending_approval', 'approved', 'applied', 'archived'
                            )),
    brief_json              JSONB NOT NULL DEFAULT '{}'::jsonb,
    strategy_framework_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    target_market_prof_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    campaigns_json          JSONB NOT NULL DEFAULT '[]'::jsonb,
    content_json            JSONB NOT NULL DEFAULT '{}'::jsonb,
    quality_score_json      JSONB NOT NULL DEFAULT '{}'::jsonb,
    marketing_plan_id       BIGINT,
    applied_at              TIMESTAMPTZ,
    created_by              VARCHAR(120) NOT NULL DEFAULT '',
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT mkt_ai_plan_versions_lifecycle_version_unique
        UNIQUE (lifecycle_id, version_no)
);

CREATE INDEX IF NOT EXISTS idx_mkt_ai_plan_versions_lifecycle
    ON mkt_ai_plan_versions (lifecycle_id, version_no DESC);

COMMENT ON TABLE mkt_ai_plan_versions IS
    'Immutable snapshots for compare/rollback and approval workflow (Phase 2).';

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'crm_marketing_plans'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'mkt_ai_plan_versions_marketing_plan_fk'
    ) THEN
        ALTER TABLE mkt_ai_plan_versions
            ADD CONSTRAINT mkt_ai_plan_versions_marketing_plan_fk
            FOREIGN KEY (marketing_plan_id) REFERENCES crm_marketing_plans (id) ON DELETE SET NULL;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'mkt_ai_drafts_last_applied_version_fk'
    ) THEN
        ALTER TABLE mkt_ai_drafts
            ADD CONSTRAINT mkt_ai_drafts_last_applied_version_fk
            FOREIGN KEY (last_applied_version_id) REFERENCES mkt_ai_plan_versions (id) ON DELETE SET NULL;
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS mkt_ai_documents (
    id                      BIGSERIAL PRIMARY KEY,
    lifecycle_id            BIGINT NOT NULL
                            REFERENCES crm_service_lifecycle (id) ON DELETE CASCADE,
    filename                TEXT NOT NULL,
    mime_type               TEXT NOT NULL DEFAULT 'application/pdf',
    storage_key             TEXT NOT NULL DEFAULT '',
    file_size_bytes         BIGINT,
    sha256_hex              VARCHAR(64),
    status                  VARCHAR(16) NOT NULL DEFAULT 'pending'
                            CHECK (status IN (
                                'pending', 'indexing', 'indexed', 'failed', 'archived'
                            )),
    chunk_count             INT NOT NULL DEFAULT 0,
    metadata_json           JSONB NOT NULL DEFAULT '{}'::jsonb,
    error_message           TEXT,
    uploaded_by             VARCHAR(120) NOT NULL DEFAULT '',
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mkt_ai_documents_lifecycle
    ON mkt_ai_documents (lifecycle_id, status, created_at DESC);

COMMENT ON TABLE mkt_ai_documents IS
    'Brand KB uploads for RAG (Phase 2 — AiBrandKbPanel).';

CREATE TABLE IF NOT EXISTS mkt_ai_document_chunks (
    id                      BIGSERIAL PRIMARY KEY,
    document_id             BIGINT NOT NULL
                            REFERENCES mkt_ai_documents (id) ON DELETE CASCADE,
    chunk_index             INT NOT NULL,
    page_no                 INT,
    title                   TEXT NOT NULL DEFAULT '',
    body                    TEXT NOT NULL,
    token_count             INT,
    embedding_json          JSONB,
    metadata_json           JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT mkt_ai_document_chunks_doc_index_unique
        UNIQUE (document_id, chunk_index)
);

CREATE INDEX IF NOT EXISTS idx_mkt_ai_document_chunks_document
    ON mkt_ai_document_chunks (document_id, chunk_index);

CREATE INDEX IF NOT EXISTS idx_mkt_ai_document_chunks_fts
    ON mkt_ai_document_chunks
    USING gin (to_tsvector('simple', coalesce(title, '') || ' ' || body));

COMMENT ON TABLE mkt_ai_document_chunks IS
    'Chunked brand KB; embedding_json MVP, pgvector column optional in Phase 2+.';

CREATE TABLE IF NOT EXISTS mkt_ai_budget_scenarios (
    id                      BIGSERIAL PRIMARY KEY,
    lifecycle_id            BIGINT NOT NULL
                            REFERENCES crm_service_lifecycle (id) ON DELETE CASCADE,
    job_id                  BIGINT REFERENCES mkt_ai_jobs (id) ON DELETE SET NULL,
    name                    TEXT NOT NULL DEFAULT '',
    slug                    TEXT NOT NULL DEFAULT '',
    budget_monthly_vnd      BIGINT NOT NULL DEFAULT 0,
    channel_mix_json        JSONB NOT NULL DEFAULT '{}'::jsonb,
    cpl_estimates_json      JSONB NOT NULL DEFAULT '{}'::jsonb,
    assumptions_json        JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_selected             BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order              INT NOT NULL DEFAULT 0,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mkt_ai_budget_scenarios_lifecycle
    ON mkt_ai_budget_scenarios (lifecycle_id, sort_order);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mkt_ai_budget_scenarios_selected
    ON mkt_ai_budget_scenarios (lifecycle_id)
    WHERE is_selected IS TRUE;

COMMENT ON TABLE mkt_ai_budget_scenarios IS
    'Budget simulator scenarios 2–5 per lifecycle (Phase 2 — AiBudgetSimulator).';

CREATE TABLE IF NOT EXISTS mkt_ai_approvals (
    id                      BIGSERIAL PRIMARY KEY,
    lifecycle_id            BIGINT NOT NULL
                            REFERENCES crm_service_lifecycle (id) ON DELETE CASCADE,
    plan_version_id         BIGINT NOT NULL
                            REFERENCES mkt_ai_plan_versions (id) ON DELETE CASCADE,
    status                  VARCHAR(16) NOT NULL DEFAULT 'pending'
                            CHECK (status IN (
                                'pending', 'approved', 'changes_requested', 'rejected', 'cancelled'
                            )),
    requested_by            VARCHAR(120) NOT NULL DEFAULT '',
    approver_email          VARCHAR(120),
    decision_note           TEXT NOT NULL DEFAULT '',
    requested_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    decided_at              TIMESTAMPTZ,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mkt_ai_approvals_lifecycle
    ON mkt_ai_approvals (lifecycle_id, status, requested_at DESC);

CREATE INDEX IF NOT EXISTS idx_mkt_ai_approvals_version
    ON mkt_ai_approvals (plan_version_id, status);

COMMENT ON TABLE mkt_ai_approvals IS
    'MKT Lead / GDKD approval gate before export (Phase 2 — AiPlanApprovalBar).';

CREATE TABLE IF NOT EXISTS mkt_ai_comments (
    id                      BIGSERIAL PRIMARY KEY,
    lifecycle_id            BIGINT NOT NULL
                            REFERENCES crm_service_lifecycle (id) ON DELETE CASCADE,
    plan_version_id         BIGINT REFERENCES mkt_ai_plan_versions (id) ON DELETE CASCADE,
    approval_id             BIGINT REFERENCES mkt_ai_approvals (id) ON DELETE SET NULL,
    author_email            VARCHAR(120) NOT NULL DEFAULT '',
    body                    TEXT NOT NULL,
    anchor_json             JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mkt_ai_comments_lifecycle
    ON mkt_ai_comments (lifecycle_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_mkt_ai_comments_version
    ON mkt_ai_comments (plan_version_id, created_at DESC);

COMMENT ON TABLE mkt_ai_comments IS
    'Review comments on plan versions / approval requests (Phase 2).';

-- ===========================================================================
-- §3 Export audit (Phase 1)
-- ===========================================================================

CREATE TABLE IF NOT EXISTS mkt_ai_exports (
    id                      BIGSERIAL PRIMARY KEY,
    lifecycle_id            BIGINT NOT NULL
                            REFERENCES crm_service_lifecycle (id) ON DELETE CASCADE,
    plan_version_id         BIGINT REFERENCES mkt_ai_plan_versions (id) ON DELETE SET NULL,
    format                  VARCHAR(16) NOT NULL
                            CHECK (format IN ('pdf', 'docx', 'xlsx', 'pptx')),
    storage_key             TEXT NOT NULL DEFAULT '',
    file_size_bytes         BIGINT,
    quality_score           INT,
    exported_by             VARCHAR(120) NOT NULL DEFAULT '',
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mkt_ai_exports_lifecycle
    ON mkt_ai_exports (lifecycle_id, created_at DESC);

COMMENT ON TABLE mkt_ai_exports IS
    'Export audit trail PDF/DOCX/XLSX (EC-MKT-AI-04).';

-- ---------------------------------------------------------------------------
-- Schema migration marker
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS schema_migrations (
    version     VARCHAR(64) PRIMARY KEY,
    applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    description TEXT
);

INSERT INTO schema_migrations (version, description) VALUES
    (
        '2026-08-08-mkt-ai-planner',
        'AI Marketing Planner: briefs, jobs, drafts, campaigns, content, versions, RAG, budget, approvals'
    )
ON CONFLICT (version) DO NOTHING;

COMMIT;
