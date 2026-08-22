-- RNOSAI — Revenue OS + AI Intelligence PostgreSQL DDL
-- Spec: docs/SPEC_AI_REVENUE_OPERATING_SYSTEM.md §9 · RNOS-01
-- Apply:
--   psql "$DATABASE_URL" -f docs/specs/2026-07-26-postgresql-ddl-revenue-os-ai.sql
-- Or: ./scripts/apply_pg_ddl_revenue_os_ai.sh
--
-- Requires: v1 (clients, domain_events, schema_migrations) + v2/v3 (crm_leads)
-- Notes:
--   - Uses client_id (agency tenant) — maps spec tenant_id
--   - entity_id TEXT — supports sqlite_lead_id, UUID strings, external ids
--   - R1 tables active; R2/R3 workflow + forecast included for forward compatibility

BEGIN;

-- ---------------------------------------------------------------------------
-- Optional: vector extension for RAG (R2) — uncomment when pgvector available
-- ---------------------------------------------------------------------------
-- CREATE EXTENSION IF NOT EXISTS vector;

-- ===========================================================================
-- §1 AI Intelligence — prompts & audit (R1 P0)
-- ===========================================================================

CREATE TABLE IF NOT EXISTS ai_prompts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    use_case        VARCHAR(64) NOT NULL,
    prompt_template TEXT NOT NULL,
    version         INT NOT NULL DEFAULT 1,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by      VARCHAR(120),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (use_case, version)
);

CREATE INDEX IF NOT EXISTS idx_ai_prompts_use_case_active
    ON ai_prompts (use_case, version DESC)
    WHERE is_active IS TRUE;

COMMENT ON TABLE ai_prompts IS
    'Versioned LLM prompt templates for ai-intelligence service (RNOS-02).';

CREATE TABLE IF NOT EXISTS ai_agent_runs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id       UUID REFERENCES clients (id) ON DELETE SET NULL,
    agent_name      VARCHAR(64) NOT NULL,
    use_case        VARCHAR(64),
    model_name      VARCHAR(128),
    prompt_hash     VARCHAR(64),
    input_json      JSONB NOT NULL DEFAULT '{}'::jsonb,
    output_json     JSONB NOT NULL DEFAULT '{}'::jsonb,
    status          VARCHAR(16) NOT NULL DEFAULT 'running'
                    CHECK (status IN ('running', 'succeeded', 'failed', 'cancelled')),
    latency_ms      INT,
    token_usage     JSONB NOT NULL DEFAULT '{}'::jsonb,
    error_message   TEXT,
    correlation_id  VARCHAR(64),
    actor_id        VARCHAR(120),
    started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at        TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_agent_runs_client_started
    ON ai_agent_runs (client_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_agent_runs_agent_status
    ON ai_agent_runs (agent_name, status, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_agent_runs_correlation
    ON ai_agent_runs (correlation_id)
    WHERE correlation_id IS NOT NULL;

COMMENT ON TABLE ai_agent_runs IS
    'Append-only audit for every AI/LLM invocation (RNOS-05, BR-AI-03).';

-- ===========================================================================
-- §2 AI scores, insights, recommendations (R1–R3)
-- ===========================================================================

CREATE TABLE IF NOT EXISTS ai_scores (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id           UUID REFERENCES clients (id) ON DELETE SET NULL,
    entity_type         VARCHAR(32) NOT NULL,
    entity_id           TEXT NOT NULL,
    score_type          VARCHAR(32) NOT NULL,
    score_value         NUMERIC(8, 4) NOT NULL,
    confidence          NUMERIC(5, 4),
    features_json       JSONB NOT NULL DEFAULT '{}'::jsonb,
    explainability_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    model_name          VARCHAR(128),
    model_version       VARCHAR(32) NOT NULL DEFAULT 'lead-v1',
    agent_run_id        UUID REFERENCES ai_agent_runs (id) ON DELETE SET NULL,
    overridden_by       VARCHAR(120),
    overridden_at       TIMESTAMPTZ,
    override_reason     TEXT,
    calculated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ai_scores_score_type_check CHECK (
        score_type IN (
            'lead', 'deal', 'churn', 'renewal', 'health', 'pipeline_risk'
        )
    ),
    CONSTRAINT ai_scores_confidence_range CHECK (
        confidence IS NULL OR (confidence >= 0 AND confidence <= 1)
    )
);

CREATE INDEX IF NOT EXISTS idx_ai_scores_entity
    ON ai_scores (entity_type, entity_id, score_type, calculated_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_scores_client_type
    ON ai_scores (client_id, score_type, calculated_at DESC)
    WHERE client_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ai_scores_lead_latest
    ON ai_scores (entity_id, calculated_at DESC)
    WHERE entity_type = 'lead' AND score_type = 'lead';

COMMENT ON TABLE ai_scores IS
    'Scoring outputs — rules v1 then ML (RNOS-04, RNOS-09). entity_id often sqlite_lead_id as text.';

CREATE TABLE IF NOT EXISTS ai_insights (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id           UUID REFERENCES clients (id) ON DELETE SET NULL,
    entity_type         VARCHAR(32) NOT NULL,
    entity_id           TEXT NOT NULL,
    insight_type        VARCHAR(64) NOT NULL,
    title               VARCHAR(255) NOT NULL,
    description         TEXT NOT NULL,
    confidence          NUMERIC(5, 4),
    severity            VARCHAR(16) NOT NULL DEFAULT 'info'
                        CHECK (severity IN ('info', 'warning', 'critical')),
    status              VARCHAR(16) NOT NULL DEFAULT 'open'
                        CHECK (status IN ('open', 'acknowledged', 'resolved', 'dismissed')),
    created_by_model    VARCHAR(128),
    agent_run_id        UUID REFERENCES ai_agent_runs (id) ON DELETE SET NULL,
    metadata            JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_insights_entity
    ON ai_insights (entity_type, entity_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_insights_client_open
    ON ai_insights (client_id, severity, created_at DESC)
    WHERE status = 'open';

COMMENT ON TABLE ai_insights IS
    'Narrative AI insights for dashboard/digest (AI-10, RNOS-28).';

CREATE TABLE IF NOT EXISTS ai_recommendations (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id               UUID REFERENCES clients (id) ON DELETE SET NULL,
    entity_type             VARCHAR(32) NOT NULL,
    entity_id               TEXT NOT NULL,
    recommendation_type     VARCHAR(64) NOT NULL,
    recommendation_text     TEXT NOT NULL,
    action_json             JSONB NOT NULL DEFAULT '{}'::jsonb,
    confidence              NUMERIC(5, 4),
    status                  VARCHAR(16) NOT NULL DEFAULT 'pending'
                            CHECK (status IN (
                                'pending', 'accepted', 'dismissed', 'executed', 'expired'
                            )),
    dismissed_reason        TEXT,
    accepted_by             VARCHAR(120),
    accepted_at             TIMESTAMPTZ,
    executed_at             TIMESTAMPTZ,
    agent_run_id            UUID REFERENCES ai_agent_runs (id) ON DELETE SET NULL,
    expires_at              TIMESTAMPTZ,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ai_recommendations_type_check CHECK (
        recommendation_type IN (
            'next_best_action', 'follow_up_draft', 'route_rep', 'rescue_playbook',
            'renewal_outreach', 'upsell', 'budget_shift'
        )
    )
);

CREATE INDEX IF NOT EXISTS idx_ai_recommendations_entity_pending
    ON ai_recommendations (entity_type, entity_id, created_at DESC)
    WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_ai_recommendations_client_status
    ON ai_recommendations (client_id, status, created_at DESC)
    WHERE client_id IS NOT NULL;

COMMENT ON TABLE ai_recommendations IS
    'NBA + draft suggestions with accept/dismiss feedback loop (RNOS-10, RNOS-29).';

CREATE TABLE IF NOT EXISTS ai_model_predictions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id           UUID REFERENCES clients (id) ON DELETE SET NULL,
    model_name          VARCHAR(128) NOT NULL,
    entity_type         VARCHAR(32) NOT NULL,
    entity_id           TEXT NOT NULL,
    prediction_type     VARCHAR(64) NOT NULL,
    prediction_value    JSONB NOT NULL,
    confidence          NUMERIC(5, 4),
    explainability_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    model_version       VARCHAR(32) NOT NULL,
    agent_run_id        UUID REFERENCES ai_agent_runs (id) ON DELETE SET NULL,
    predicted_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_model_predictions_entity
    ON ai_model_predictions (entity_type, entity_id, prediction_type, predicted_at DESC);

COMMENT ON TABLE ai_model_predictions IS
    'Structured ML predictions (win prob, churn, forecast line items) — R2+.';

-- ===========================================================================
-- §3 Unified timeline & revenue behavior (Phase 0 / R2)
-- ===========================================================================

CREATE TABLE IF NOT EXISTS customer_timeline_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id       UUID REFERENCES clients (id) ON DELETE SET NULL,
    entity_type     VARCHAR(32) NOT NULL,
    entity_id       TEXT NOT NULL,
    event_type      VARCHAR(64) NOT NULL,
    event_source    VARCHAR(32) NOT NULL
                    CHECK (event_source IN (
                        'crm', 'meta', 'zalo', 'email', 'seo', 'call', 'system', 'ai'
                    )),
    title           VARCHAR(255),
    body            TEXT,
    payload         JSONB NOT NULL DEFAULT '{}'::jsonb,
    occurred_at     TIMESTAMPTZ NOT NULL,
    actor_id        VARCHAR(120),
    external_ref    VARCHAR(255),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_timeline_entity
    ON customer_timeline_events (entity_type, entity_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_customer_timeline_client
    ON customer_timeline_events (client_id, occurred_at DESC)
    WHERE client_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_customer_timeline_source
    ON customer_timeline_events (event_source, occurred_at DESC);

COMMENT ON TABLE customer_timeline_events IS
    'Unified interaction timeline — Meta/Zalo/Email/CRM/AI (RNOS-16, Phase 0).';

CREATE TABLE IF NOT EXISTS customer_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id       UUID REFERENCES clients (id) ON DELETE SET NULL,
    entity_type     VARCHAR(32) NOT NULL,
    entity_id       TEXT NOT NULL,
    event_name      VARCHAR(64) NOT NULL,
    event_source    VARCHAR(32) NOT NULL,
    event_value     NUMERIC(18, 4),
    occurred_at     TIMESTAMPTZ NOT NULL,
    payload         JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_events_entity_time
    ON customer_events (entity_type, entity_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_customer_events_name
    ON customer_events (event_name, occurred_at DESC);

COMMENT ON TABLE customer_events IS
    'Behavioral event stream for scoring/ML feature extraction.';

CREATE TABLE IF NOT EXISTS behavior_signals (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id       UUID REFERENCES clients (id) ON DELETE SET NULL,
    entity_type     VARCHAR(32) NOT NULL,
    entity_id       TEXT NOT NULL,
    signal_type     VARCHAR(64) NOT NULL,
    signal_strength NUMERIC(8, 4) NOT NULL,
    signal_value    JSONB NOT NULL DEFAULT '{}'::jsonb,
    window_start    TIMESTAMPTZ NOT NULL,
    window_end      TIMESTAMPTZ NOT NULL,
    computed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_behavior_signals_entity
    ON behavior_signals (entity_type, entity_id, signal_type, window_end DESC);

COMMENT ON TABLE behavior_signals IS
    'Aggregated signals (engagement decay, SLA risk, spend tier) for AI features.';

CREATE TABLE IF NOT EXISTS revenue_actions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id       UUID REFERENCES clients (id) ON DELETE SET NULL,
    entity_type     VARCHAR(32) NOT NULL,
    entity_id       TEXT NOT NULL,
    action_type     VARCHAR(64) NOT NULL,
    status          VARCHAR(16) NOT NULL DEFAULT 'recommended'
                    CHECK (status IN (
                        'recommended', 'approved', 'executed', 'failed', 'cancelled'
                    )),
    recommended_by  VARCHAR(128) NOT NULL DEFAULT 'ai',
    executed_by     VARCHAR(120),
    recommendation_id UUID REFERENCES ai_recommendations (id) ON DELETE SET NULL,
    action_json     JSONB NOT NULL DEFAULT '{}'::jsonb,
    executed_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_revenue_actions_entity
    ON revenue_actions (entity_type, entity_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_revenue_actions_status
    ON revenue_actions (status, created_at DESC)
    WHERE status IN ('recommended', 'approved');

COMMENT ON TABLE revenue_actions IS
    'Executable revenue actions linked to NBA recommendations (HITL).';

-- ===========================================================================
-- §4 Forecast snapshots (R3)
-- ===========================================================================

CREATE TABLE IF NOT EXISTS revenue_forecast_snapshots (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id           UUID REFERENCES clients (id) ON DELETE SET NULL,
    snapshot_date       DATE NOT NULL,
    pipeline_id         UUID,
    owner_user_id       VARCHAR(120),
    team_id             VARCHAR(64),
    committed_amount    NUMERIC(18, 2) NOT NULL DEFAULT 0,
    best_case_amount    NUMERIC(18, 2) NOT NULL DEFAULT 0,
    pipeline_amount     NUMERIC(18, 2) NOT NULL DEFAULT 0,
    forecast_amount     NUMERIC(18, 2) NOT NULL DEFAULT 0,
    ai_adjustment       NUMERIC(18, 2),
    confidence_score    NUMERIC(5, 4),
    currency            VARCHAR(3) NOT NULL DEFAULT 'VND',
    committed_by        VARCHAR(120),
    committed_at        TIMESTAMPTZ,
    metadata            JSONB NOT NULL DEFAULT '{}'::jsonb,
    agent_run_id        UUID REFERENCES ai_agent_runs (id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_revenue_forecast_snapshots_date
    ON revenue_forecast_snapshots (snapshot_date DESC, client_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_revenue_forecast_snapshots_unique
    ON revenue_forecast_snapshots (
        COALESCE(client_id, '00000000-0000-0000-0000-000000000000'::uuid),
        snapshot_date,
        COALESCE(owner_user_id, ''),
        COALESCE(team_id, ''),
        COALESCE(pipeline_id, '00000000-0000-0000-0000-000000000000'::uuid)
    );

COMMENT ON TABLE revenue_forecast_snapshots IS
    'Daily pipeline forecast + manager commit (RNOS-17, RNOS-18).';

-- ===========================================================================
-- §5 Automation workflow engine (R2 skeleton)
-- ===========================================================================

CREATE TABLE IF NOT EXISTS automation_workflows (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id       UUID REFERENCES clients (id) ON DELETE CASCADE,
    name            VARCHAR(255) NOT NULL,
    trigger_type    VARCHAR(32) NOT NULL
                    CHECK (trigger_type IN (
                        'event', 'schedule', 'manual', 'webhook'
                    )),
    status          VARCHAR(16) NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft', 'active', 'paused', 'archived')),
    version         INT NOT NULL DEFAULT 1,
    definition_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by      VARCHAR(120),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_automation_workflows_client_status
    ON automation_workflows (client_id, status)
    WHERE client_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS automation_workflow_nodes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id     UUID NOT NULL REFERENCES automation_workflows (id) ON DELETE CASCADE,
    node_key        VARCHAR(64) NOT NULL,
    node_type       VARCHAR(32) NOT NULL
                    CHECK (node_type IN (
                        'trigger', 'condition', 'delay', 'assign_task', 'send_message',
                        'update_field', 'create_opportunity', 'create_ticket',
                        'ai_score', 'ai_summarize', 'webhook', 'approval'
                    )),
    config_json     JSONB NOT NULL DEFAULT '{}'::jsonb,
    next_node_key   VARCHAR(64),
    sort_order      INT NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (workflow_id, node_key)
);

CREATE INDEX IF NOT EXISTS idx_automation_workflow_nodes_workflow
    ON automation_workflow_nodes (workflow_id, sort_order);

CREATE TABLE IF NOT EXISTS automation_workflow_executions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id     UUID NOT NULL REFERENCES automation_workflows (id) ON DELETE CASCADE,
    client_id       UUID REFERENCES clients (id) ON DELETE SET NULL,
    entity_type     VARCHAR(32),
    entity_id       TEXT,
    status          VARCHAR(16) NOT NULL DEFAULT 'pending'
                    CHECK (status IN (
                        'pending', 'running', 'waiting', 'succeeded', 'failed', 'cancelled'
                    )),
    idempotency_key VARCHAR(128),
    current_node_key VARCHAR(64),
    context_json    JSONB NOT NULL DEFAULT '{}'::jsonb,
    error_message   TEXT,
    started_at      TIMESTAMPTZ,
    ended_at        TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_automation_workflow_executions_idempotency
    ON automation_workflow_executions (idempotency_key)
    WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_automation_workflow_executions_workflow
    ON automation_workflow_executions (workflow_id, status, created_at DESC);

COMMENT ON TABLE automation_workflows IS
    'Low-code workflow definitions (RNOS-13, RNOS-14) — Temporal bridge optional.';

-- ===========================================================================
-- §6 Customer success — health & renewal (R3 skeleton)
-- ===========================================================================

CREATE TABLE IF NOT EXISTS customer_health_scores (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id       UUID NOT NULL REFERENCES clients (id) ON DELETE CASCADE,
    score           NUMERIC(8, 4) NOT NULL,
    components_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    ai_score_id     UUID REFERENCES ai_scores (id) ON DELETE SET NULL,
    calculated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_health_scores_client
    ON customer_health_scores (client_id, calculated_at DESC);

CREATE TABLE IF NOT EXISTS renewal_opportunities (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id       UUID NOT NULL REFERENCES clients (id) ON DELETE CASCADE,
    contract_ref    VARCHAR(128),
    renewal_date    DATE NOT NULL,
    risk_level      VARCHAR(16) NOT NULL DEFAULT 'medium'
                    CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
    status          VARCHAR(16) NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open', 'in_progress', 'renewed', 'lost', 'deferred')),
    owner_am_id     VARCHAR(120),
    ai_score_id     UUID REFERENCES ai_scores (id) ON DELETE SET NULL,
    metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_renewal_opportunities_date
    ON renewal_opportunities (renewal_date, status);

CREATE INDEX IF NOT EXISTS idx_renewal_opportunities_client
    ON renewal_opportunities (client_id, renewal_date);

COMMENT ON TABLE renewal_opportunities IS
    'Agency client contract renewal tracking — Renewal Agent (RNOS-20).';

-- ===========================================================================
-- §7 Playbook library + vector chunks (RNOS-12, RNOS-36)
-- ===========================================================================

CREATE TABLE IF NOT EXISTS ai_playbooks (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id       UUID REFERENCES clients (id) ON DELETE CASCADE,
    slug            VARCHAR(128) NOT NULL,
    title           VARCHAR(255) NOT NULL,
    category        VARCHAR(64) NOT NULL DEFAULT 'sales',
    summary         TEXT NOT NULL DEFAULT '',
    status          VARCHAR(16) NOT NULL DEFAULT 'active'
                    CHECK (status IN ('draft', 'active', 'archived')),
    tags            JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_by      VARCHAR(120),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ai_playbooks_slug_unique UNIQUE (slug)
);

CREATE INDEX IF NOT EXISTS idx_ai_playbooks_status
    ON ai_playbooks (status, updated_at DESC);

CREATE TABLE IF NOT EXISTS ai_playbook_chunks (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    playbook_id     UUID NOT NULL REFERENCES ai_playbooks (id) ON DELETE CASCADE,
    chunk_key       VARCHAR(64) NOT NULL,
    title           VARCHAR(255) NOT NULL DEFAULT '',
    body            TEXT NOT NULL,
    embedding_json  JSONB,
    token_count     INT,
    sort_order      INT NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ai_playbook_chunks_key_unique UNIQUE (playbook_id, chunk_key)
);

CREATE INDEX IF NOT EXISTS idx_ai_playbook_chunks_playbook
    ON ai_playbook_chunks (playbook_id, sort_order, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_playbook_chunks_fts
    ON ai_playbook_chunks USING gin (to_tsvector('simple', coalesce(title, '') || ' ' || body));

COMMENT ON TABLE ai_playbooks IS
    'Sales/CS playbook library for RAG retrieval (RNOS-12, RNOS-36).';
COMMENT ON TABLE ai_playbook_chunks IS
    'Chunked playbook content with embedding_json vector store (RNOS-12).';

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
        '2026-07-26-revenue-os-ai',
        'Revenue OS AI: ai_* tables, timeline, behavior, forecast, workflow skeleton'
    )
ON CONFLICT (version) DO NOTHING;

COMMIT;
