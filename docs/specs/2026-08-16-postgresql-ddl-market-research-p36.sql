-- Market Research OS P36 — 2026-08-16 (IVFFlat index on embedding_vec, fail-soft apply)
-- Requires postgresql-xx-pgvector + P20 embedding_vec column.

CREATE INDEX IF NOT EXISTS crm_research_emb_vec_ivf
  ON crm_research_insight_embeddings
  USING ivfflat (embedding_vec vector_cosine_ops)
  WITH (lists = 10);

CREATE TABLE IF NOT EXISTS schema_migrations (
    version     VARCHAR(64) PRIMARY KEY,
    applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    description TEXT
);

INSERT INTO schema_migrations (version, description) VALUES
    (
        '2026-08-16-market-research-p36',
        'P36: IVFFlat index on crm_research_insight_embeddings.embedding_vec'
    )
ON CONFLICT (version) DO NOTHING;
