-- Market Research OS P7 — 2026-08-14 (RAG embeddings + taxonomy)

CREATE TABLE IF NOT EXISTS crm_research_insight_embeddings (
  insight_id   BIGINT PRIMARY KEY REFERENCES crm_research_insights(id) ON DELETE CASCADE,
  project_id   BIGINT NOT NULL REFERENCES crm_research_projects(id) ON DELETE CASCADE,
  embedding    JSONB NOT NULL,
  embed_text   TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS crm_research_insight_embeddings_project_idx
  ON crm_research_insight_embeddings (project_id);

CREATE TABLE IF NOT EXISTS crm_research_taxonomy (
  id          BIGSERIAL PRIMARY KEY,
  theme_code  TEXT NOT NULL UNIQUE,
  label_vi    TEXT NOT NULL,
  synonyms    TEXT[] NOT NULL DEFAULT '{}',
  active      BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crm_research_insight_themes (
  insight_id   BIGINT NOT NULL REFERENCES crm_research_insights(id) ON DELETE CASCADE,
  taxonomy_id  BIGINT NOT NULL REFERENCES crm_research_taxonomy(id) ON DELETE CASCADE,
  created_by   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (insight_id, taxonomy_id)
);

INSERT INTO crm_research_taxonomy (theme_code, label_vi, synonyms) VALUES
  ('PRICE', 'Giá', ARRAY['pricing', 'giá bán']),
  ('CHANNEL', 'Kênh', ARRAY['phân phối']),
  ('COMPETITOR', 'Đối thủ', ARRAY['cạnh tranh']),
  ('TREND', 'Xu hướng', ARRAY['emerging']),
  ('SEGMENT', 'Phân khúc', ARRAY['đối tượng']),
  ('RISK', 'Rủi ro', ARRAY['limitation']),
  ('MESSAGE', 'Thông điệp', ARRAY['claim']),
  ('GEO', 'Địa bàn', ARRAY['khu vực'])
ON CONFLICT (theme_code) DO NOTHING;

CREATE TABLE IF NOT EXISTS schema_migrations (
    version     VARCHAR(64) PRIMARY KEY,
    applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    description TEXT
);

INSERT INTO schema_migrations (version, description) VALUES
    (
        '2026-08-14-market-research-p7-m1',
        'P7 M1: crm_research_insight_embeddings + taxonomy + insight_themes'
    )
ON CONFLICT (version) DO NOTHING;
