-- Market Research OS P2 — 2026-08-14 (M1 studies + consent + trend_signals)

CREATE TABLE IF NOT EXISTS crm_research_studies (
  id                  BIGSERIAL PRIMARY KEY,
  project_id          BIGINT NOT NULL REFERENCES crm_research_projects(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  method              TEXT NOT NULL CHECK (method IN ('survey','idi','fgd','diary')),
  n                   INT,
  field_start         DATE,
  field_end           DATE,
  mode                TEXT CHECK (mode IS NULL OR mode IN ('online','f2f','phone','mixed')),
  instrument_version  TEXT,
  weighting_note      TEXT,
  created_by          TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crm_research_consents (
  id            BIGSERIAL PRIMARY KEY,
  study_id      BIGINT NOT NULL REFERENCES crm_research_studies(id) ON DELETE CASCADE,
  project_id    BIGINT NOT NULL REFERENCES crm_research_projects(id) ON DELETE CASCADE,
  subject_code  TEXT NOT NULL,
  consent_type  TEXT NOT NULL CHECK (consent_type IN ('record','quote','store')),
  recorded_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at    TIMESTAMPTZ NOT NULL,
  notes         TEXT,
  created_by    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crm_research_trend_signals (
  id          BIGSERIAL PRIMARY KEY,
  project_id  BIGINT NOT NULL REFERENCES crm_research_projects(id) ON DELETE CASCADE,
  topic       TEXT NOT NULL,
  metric      TEXT NOT NULL,
  baseline    NUMERIC,
  current     NUMERIC,
  velocity    NUMERIC,
  lifecycle   TEXT NOT NULL CHECK (lifecycle IN ('new','rising','stable','fading')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
DECLARE
  orphan_ids TEXT;
BEGIN
  BEGIN
    ALTER TABLE crm_research_evidence
      ADD CONSTRAINT crm_research_evidence_study_fk
      FOREIGN KEY (study_id) REFERENCES crm_research_studies(id) ON DELETE RESTRICT
      NOT VALID;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER TABLE crm_research_evidence
      VALIDATE CONSTRAINT crm_research_evidence_study_fk;
  EXCEPTION
    WHEN foreign_key_violation THEN
      SELECT string_agg(e.id::text, ', ' ORDER BY e.id)
        INTO orphan_ids
      FROM crm_research_evidence e
      WHERE e.study_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM crm_research_studies s WHERE s.id = e.study_id
        );
      RAISE EXCEPTION
        'crm_research_evidence_study_fk VALIDATE failed: orphan study_id on crm_research_evidence.id = %',
        COALESCE(orphan_ids, '(query returned no ids)');
  END;
END $$;

ALTER TABLE crm_research_ai_runs DROP CONSTRAINT IF EXISTS crm_research_ai_runs_type_chk;
ALTER TABLE crm_research_ai_runs ADD CONSTRAINT crm_research_ai_runs_type_chk CHECK (job_type IN (
  'desk_tavily','deep_research','insight_draft','report_draft','pii_scan',
  'research_triangulate','research_pulse'));

CREATE TABLE IF NOT EXISTS schema_migrations (
    version     VARCHAR(64) PRIMARY KEY,
    applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    description TEXT
);

INSERT INTO schema_migrations (version, description) VALUES
    (
        '2026-08-14-market-research-p2-m1',
        'P2 M1: crm_research_studies + consents + trend_signals; evidence study FK'
    )
ON CONFLICT (version) DO NOTHING;
