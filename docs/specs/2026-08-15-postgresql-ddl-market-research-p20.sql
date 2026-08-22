-- Market Research OS P20 — 2026-08-15 (pgvector dual-write column)
-- Requires postgresql-xx-pgvector. Apply script is fail-soft if missing.

CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE crm_research_insight_embeddings
  ADD COLUMN IF NOT EXISTS embedding_vec vector;

CREATE TABLE IF NOT EXISTS schema_migrations (
    version     VARCHAR(64) PRIMARY KEY,
    applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    description TEXT
);

INSERT INTO schema_migrations (version, description) VALUES
    (
        '2026-08-15-market-research-p20',
        'P20: pgvector extension + embedding_vec dual-write column'
    )
ON CONFLICT (version) DO NOTHING;
