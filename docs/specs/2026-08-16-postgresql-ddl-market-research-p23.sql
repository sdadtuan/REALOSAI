-- Market Research OS P23 — 2026-08-16 (talkwalker job_type)

ALTER TABLE crm_research_ai_runs DROP CONSTRAINT IF EXISTS crm_research_ai_runs_type_chk;
ALTER TABLE crm_research_ai_runs ADD CONSTRAINT crm_research_ai_runs_type_chk CHECK (job_type IN (
  'desk_tavily','deep_research','insight_draft','report_draft','pii_scan',
  'research_triangulate','research_pulse','whisper_ingest','sparktoro','qualtrics','rag_reembed','talkwalker'));

CREATE TABLE IF NOT EXISTS schema_migrations (
    version     VARCHAR(64) PRIMARY KEY,
    applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    description TEXT
);

INSERT INTO schema_migrations (version, description) VALUES
    (
        '2026-08-16-market-research-p23',
        'P23 M2: crm_research_ai_runs job_type talkwalker'
    )
ON CONFLICT (version) DO NOTHING;
