-- RNOS-31 — Multi-agent orchestrator (PostgreSQL target)
-- Extends ai_agent_runs with parent/child run tree + ai_orchestrations metadata

BEGIN;

-- ai_agent_runs extensions
ALTER TABLE ai_agent_runs
  ADD COLUMN IF NOT EXISTS parent_run_id UUID REFERENCES ai_agent_runs(id),
  ADD COLUMN IF NOT EXISTS orchestration_id UUID,
  ADD COLUMN IF NOT EXISTS step_key VARCHAR(64),
  ADD COLUMN IF NOT EXISTS step_index INT;

CREATE INDEX IF NOT EXISTS idx_ai_agent_runs_parent ON ai_agent_runs(parent_run_id);
CREATE INDEX IF NOT EXISTS idx_ai_agent_runs_orch ON ai_agent_runs(orchestration_id);

-- Top-level orchestration metadata
CREATE TABLE IF NOT EXISTS ai_orchestrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID,
  trigger_type VARCHAR(32) NOT NULL,  -- manual | cron | webhook | workflow
  trigger_ref VARCHAR(128),
  plan_key VARCHAR(64) NOT NULL,      -- e.g. lead_intake_v1
  status VARCHAR(16) NOT NULL DEFAULT 'running',
  input_json JSONB NOT NULL DEFAULT '{}',
  output_json JSONB NOT NULL DEFAULT '{}',
  correlation_id VARCHAR(64),
  actor_id VARCHAR(64),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_orchestrations_client ON ai_orchestrations(client_id, started_at DESC);

COMMENT ON TABLE ai_orchestrations IS
    'RNOS-31 — top-level multi-agent orchestration runs with nested ai_agent_runs audit tree.';

INSERT INTO schema_migrations (version, description) VALUES
    (
        '2026-07-27-rnos31-orchestrator',
        'RNOS-31: ai_orchestrations + ai_agent_runs parent/child orchestration columns'
    )
ON CONFLICT (version) DO NOTHING;

COMMIT;
