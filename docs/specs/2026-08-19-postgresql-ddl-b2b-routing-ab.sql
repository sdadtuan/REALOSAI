-- B2B routing A/B experiment rows (first assign strategy vs outcome)
BEGIN;

CREATE TABLE IF NOT EXISTS crm_b2b_routing_ab (
  lead_id BIGINT PRIMARY KEY,
  bucket TEXT NOT NULL CHECK (bucket IN ('ai_analytics', 'hybrid')),
  strategy TEXT NOT NULL CHECK (strategy IN ('ai_analytics', 'hybrid', 'hybrid_timeout')),
  won BOOLEAN,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_b2b_routing_ab_created ON crm_b2b_routing_ab (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_b2b_routing_ab_strategy ON crm_b2b_routing_ab (strategy, won);

COMMIT;
