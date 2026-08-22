-- Market Research OS P6 — 2026-08-14 (Van Westendorp lite summaries)

CREATE TABLE IF NOT EXISTS crm_research_vw_summaries (
  id              BIGSERIAL PRIMARY KEY,
  project_id      BIGINT NOT NULL REFERENCES crm_research_projects(id) ON DELETE CASCADE,
  study_id        BIGINT REFERENCES crm_research_studies(id) ON DELETE SET NULL,
  unit            TEXT NOT NULL,
  n               INT NOT NULL,
  bins            JSONB NOT NULL,
  points          JSONB NOT NULL,
  limitation_note TEXT NOT NULL,
  statistical_inference BOOLEAN NOT NULL DEFAULT false,
  created_by      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS crm_research_vw_summaries_project_idx
  ON crm_research_vw_summaries (project_id, id DESC);

CREATE TABLE IF NOT EXISTS schema_migrations (
    version     VARCHAR(64) PRIMARY KEY,
    applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    description TEXT
);

INSERT INTO schema_migrations (version, description) VALUES
    (
        '2026-08-14-market-research-p6-m3',
        'P6 M3: crm_research_vw_summaries Van Westendorp lite'
    )
ON CONFLICT (version) DO NOTHING;
