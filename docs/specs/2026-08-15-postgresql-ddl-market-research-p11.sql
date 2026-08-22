-- Market Research OS P11 — 2026-08-15 (embed_model + embed_dims on insight embeddings)

ALTER TABLE crm_research_insight_embeddings
  ADD COLUMN IF NOT EXISTS embed_model TEXT NOT NULL DEFAULT 'local-hash';
ALTER TABLE crm_research_insight_embeddings
  ADD COLUMN IF NOT EXISTS embed_dims INT NOT NULL DEFAULT 64;

CREATE TABLE IF NOT EXISTS schema_migrations (
    version     VARCHAR(64) PRIMARY KEY,
    applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    description TEXT
);

INSERT INTO schema_migrations (version, description) VALUES
    (
        '2026-08-15-market-research-p11',
        'P11 embed_model + embed_dims on insight embeddings'
    )
ON CONFLICT (version) DO NOTHING;
