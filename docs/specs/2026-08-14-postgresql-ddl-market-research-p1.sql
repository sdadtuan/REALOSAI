-- Market Research OS P1 — 2026-08-14 (M2 competitor + snapshot)

CREATE TABLE IF NOT EXISTS crm_research_competitors (
  id           BIGSERIAL PRIMARY KEY,
  project_id   BIGINT NOT NULL REFERENCES crm_research_projects(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  aliases      JSONB NOT NULL DEFAULT '[]',
  created_by   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crm_research_competitor_snapshots (
  id              BIGSERIAL PRIMARY KEY,
  competitor_id   BIGINT NOT NULL REFERENCES crm_research_competitors(id) ON DELETE CASCADE,
  project_id      BIGINT NOT NULL REFERENCES crm_research_projects(id) ON DELETE CASCADE,
  source_id       BIGINT NOT NULL REFERENCES crm_research_sources(id),
  observed_at     DATE NOT NULL,
  kind            TEXT NOT NULL CHECK (kind IN ('fact', 'hypothesis')),
  fact            JSONB NOT NULL DEFAULT '{}',
  limitation_note TEXT,
  created_by      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE crm_research_sources
  ADD COLUMN IF NOT EXISTS limitation_note TEXT,
  ADD COLUMN IF NOT EXISTS triangulated BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS single_source_accepted BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE crm_research_ai_runs DROP CONSTRAINT IF EXISTS crm_research_ai_runs_type_chk;
ALTER TABLE crm_research_ai_runs ADD CONSTRAINT crm_research_ai_runs_type_chk CHECK (job_type IN (
  'desk_tavily','deep_research','insight_draft','report_draft','pii_scan','research_triangulate'));

CREATE INDEX IF NOT EXISTS crm_research_competitors_project_idx
  ON crm_research_competitors (project_id, id);

CREATE INDEX IF NOT EXISTS crm_research_competitor_snapshots_comp_idx
  ON crm_research_competitor_snapshots (competitor_id, id);

CREATE TABLE IF NOT EXISTS schema_migrations (
    version     VARCHAR(64) PRIMARY KEY,
    applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    description TEXT
);

INSERT INTO schema_migrations (version, description) VALUES
    (
        '2026-08-14-market-research-p1-m2',
        'P1 M2: crm_research_competitors + snapshots; source limitation_note'
    )
ON CONFLICT (version) DO NOTHING;
