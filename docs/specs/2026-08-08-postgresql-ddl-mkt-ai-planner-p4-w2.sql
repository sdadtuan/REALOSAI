-- MKT-AI Planner Phase 4 Wave 2 (WS-P4-04) — strategy scenarios + section comments
-- Run after 2026-08-08-postgresql-ddl-mkt-ai-planner-p4.sql

CREATE TABLE IF NOT EXISTS mkt_ai_strategy_scenarios (
  id              BIGSERIAL PRIMARY KEY,
  lifecycle_id    BIGINT NOT NULL,
  job_id          BIGINT REFERENCES mkt_ai_jobs(id) ON DELETE SET NULL,
  label           VARCHAR(120) NOT NULL,
  variant_slug    VARCHAR(64) NOT NULL,
  variant_index   INT NOT NULL DEFAULT 0,
  strategy_framework_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  target_market_prof_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  swot_json       JSONB NOT NULL DEFAULT '{}'::jsonb,
  channel_focus_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  messaging_json  JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_selected     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mkt_ai_strategy_scenarios_lifecycle
  ON mkt_ai_strategy_scenarios (lifecycle_id, variant_index);

COMMENT ON TABLE mkt_ai_strategy_scenarios IS 'Strategy scenario variants for compare (MKTP-UC-027)';

CREATE TABLE IF NOT EXISTS mkt_ai_section_comments (
  id              BIGSERIAL PRIMARY KEY,
  lifecycle_id    BIGINT NOT NULL,
  section_key     VARCHAR(64) NOT NULL,
  author_email    VARCHAR(255) NOT NULL,
  body            TEXT NOT NULL,
  mention_email   VARCHAR(255),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mkt_ai_section_comments_lifecycle
  ON mkt_ai_section_comments (lifecycle_id, section_key, created_at DESC);

COMMENT ON TABLE mkt_ai_section_comments IS 'Staff-only inline comments on strategy/campaign sections (MKTP-UC-029)';

ALTER TABLE mkt_ai_budget_scenarios
  ADD COLUMN IF NOT EXISTS rationale_vi TEXT;

COMMENT ON COLUMN mkt_ai_budget_scenarios.rationale_vi IS 'Vietnamese rationale for budget scenario (MKTP-UC-027)';

-- Allow strategy_scenarios job type (WS-P4-04)
ALTER TABLE mkt_ai_jobs DROP CONSTRAINT IF EXISTS mkt_ai_jobs_type_check;
ALTER TABLE mkt_ai_jobs ADD CONSTRAINT mkt_ai_jobs_type_check CHECK (
  job_type IN (
    'brief_summarize',
    'strategy_generate',
    'campaign_generate',
    'content_generate',
    'quality_score',
    'apply_to_tmmt',
    'budget_simulate',
    'optimize',
    'multi_agent',
    'strategy_scenarios'
  )
);
