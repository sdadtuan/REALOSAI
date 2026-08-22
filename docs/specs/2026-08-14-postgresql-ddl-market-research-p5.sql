-- Market Research OS P5 — 2026-08-14 (whisper_ingest + sparktoro job types)

ALTER TABLE crm_research_ai_runs DROP CONSTRAINT IF EXISTS crm_research_ai_runs_type_chk;
ALTER TABLE crm_research_ai_runs ADD CONSTRAINT crm_research_ai_runs_type_chk CHECK (job_type IN (
  'desk_tavily','deep_research','insight_draft','report_draft','pii_scan',
  'research_triangulate','research_pulse','whisper_ingest','sparktoro'));

CREATE TABLE IF NOT EXISTS schema_migrations (
    version     VARCHAR(64) PRIMARY KEY,
    applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    description TEXT
);

INSERT INTO schema_migrations (version, description) VALUES
    (
        '2026-08-14-market-research-p5-m1',
        'P5 M1: crm_research_ai_runs job_type whisper_ingest + sparktoro'
    )
ON CONFLICT (version) DO NOTHING;
