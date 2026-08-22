-- Market Research OS P38 — 2026-08-16 (Conjoint what-if run history)

CREATE TABLE IF NOT EXISTS crm_research_cj_whatif_runs (
  id                    BIGSERIAL PRIMARY KEY,
  project_id            BIGINT NOT NULL REFERENCES crm_research_projects(id) ON DELETE CASCADE,
  study_id              BIGINT REFERENCES crm_research_studies(id) ON DELETE SET NULL,
  scenario              JSONB NOT NULL,
  n_match               INT NOT NULL,
  n_choices             INT NOT NULL,
  match_pct             NUMERIC(6,2) NOT NULL,
  limitation_note       TEXT NOT NULL,
  statistical_inference BOOLEAN NOT NULL DEFAULT false,
  created_by            TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS crm_research_cj_whatif_project_idx
  ON crm_research_cj_whatif_runs (project_id, id DESC);

CREATE TABLE IF NOT EXISTS schema_migrations (
    version     VARCHAR(64) PRIMARY KEY,
    applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    description TEXT
);

INSERT INTO schema_migrations (version, description) VALUES
    (
        '2026-08-16-market-research-p38',
        'P38: crm_research_cj_whatif_runs Conjoint what-if history'
    )
ON CONFLICT (version) DO NOTHING;
