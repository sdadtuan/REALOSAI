-- RNOS-33 — AI tool API keys + call audit log (PostgreSQL target)

BEGIN;

CREATE TABLE IF NOT EXISTS ai_tool_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(128) NOT NULL,
  key_prefix VARCHAR(12) NOT NULL,
  key_hash VARCHAR(64) NOT NULL,
  client_id UUID,
  allowed_tools JSONB NOT NULL DEFAULT '[]',
  rate_limit_per_min INT NOT NULL DEFAULT 60,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by VARCHAR(64),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_ai_tool_api_keys_hash ON ai_tool_api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_ai_tool_api_keys_active ON ai_tool_api_keys(is_active, revoked_at);

CREATE TABLE IF NOT EXISTS ai_tool_call_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id UUID REFERENCES ai_tool_api_keys(id),
  tool_name VARCHAR(64) NOT NULL,
  input_json JSONB NOT NULL DEFAULT '{}',
  output_json JSONB NOT NULL DEFAULT '{}',
  status VARCHAR(16) NOT NULL,
  latency_ms INT,
  agent_run_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_tool_call_log_key ON ai_tool_call_log(api_key_id, created_at DESC);

COMMENT ON TABLE ai_tool_api_keys IS
    'RNOS-33 — scoped API keys for external AI tool invocation (hash-only storage).';

COMMENT ON TABLE ai_tool_call_log IS
    'RNOS-33 — audit trail for AI tool calls authenticated via ai_tool_api_keys.';

INSERT INTO schema_migrations (version, description) VALUES
    (
        '2026-07-27-rnos33-ai-tools',
        'RNOS-33: ai_tool_api_keys + ai_tool_call_log for MCP tool API'
    )
ON CONFLICT (version) DO NOTHING;

COMMIT;
