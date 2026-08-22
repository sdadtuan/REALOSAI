-- Market Research OS P21 — 2026-08-15 (Conjoint lite summaries)

CREATE TABLE IF NOT EXISTS crm_research_cj_summaries (
  id              BIGSERIAL PRIMARY KEY,
  project_id      BIGINT NOT NULL REFERENCES crm_research_projects(id) ON DELETE CASCADE,
  study_id        BIGINT REFERENCES crm_research_studies(id) ON DELETE SET NULL,
  n               INT NOT NULL,
  n_choices       INT NOT NULL,
  attributes      JSONB NOT NULL,
  recommendation  JSONB NOT NULL,
  limitation_note TEXT NOT NULL,
  statistical_inference BOOLEAN NOT NULL DEFAULT false,
  created_by      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS crm_research_cj_summaries_project_idx
  ON crm_research_cj_summaries (project_id, id DESC);

CREATE TABLE IF NOT EXISTS schema_migrations (
    version     VARCHAR(64) PRIMARY KEY,
    applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    description TEXT
);

INSERT INTO schema_migrations (version, description) VALUES
    (
        '2026-08-15-market-research-p21',
        'P21: crm_research_cj_summaries Conjoint lite'
    )
ON CONFLICT (version) DO NOTHING;
