-- Market Research OS P3 — 2026-08-14 (M1 portal_visible + waves + decisions)

ALTER TABLE crm_research_report_versions
  ADD COLUMN IF NOT EXISTS portal_visible BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS crm_research_waves (
  id           BIGSERIAL PRIMARY KEY,
  project_id   BIGINT NOT NULL REFERENCES crm_research_projects(id) ON DELETE CASCADE,
  wave_no      INT NOT NULL,
  label        TEXT,
  field_start  DATE,
  field_end    DATE,
  metric_json  JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, wave_no)
);

CREATE TABLE IF NOT EXISTS crm_research_decisions (
  id             BIGSERIAL PRIMARY KEY,
  project_id     BIGINT NOT NULL REFERENCES crm_research_projects(id) ON DELETE CASCADE,
  insight_id     BIGINT NOT NULL REFERENCES crm_research_insights(id) ON DELETE RESTRICT,
  decision_text  TEXT NOT NULL,
  owner_email    TEXT NOT NULL,
  due_at         DATE,
  status         TEXT NOT NULL DEFAULT 'open'
                   CHECK (status IN ('open','done','dropped')),
  created_by     TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS crm_research_waves_project_idx
  ON crm_research_waves (project_id, wave_no DESC);
CREATE INDEX IF NOT EXISTS crm_research_decisions_project_idx
  ON crm_research_decisions (project_id, created_at DESC);

INSERT INTO schema_migrations (version, description) VALUES
  ('2026-08-14-market-research-p3-m1', 'P3: portal_visible + waves + decisions')
ON CONFLICT (version) DO NOTHING;
