-- Market Research OS P0 — 2026-08-14

CREATE TABLE IF NOT EXISTS crm_research_projects (
  id                    BIGSERIAL PRIMARY KEY,
  client_id             TEXT NOT NULL,
  lifecycle_id          BIGINT,
  title                 TEXT NOT NULL,
  product_type          TEXT NOT NULL,
  dv12_tier             TEXT NOT NULL DEFAULT 'CB',
  decision_statement    TEXT NOT NULL,
  geo                   JSONB NOT NULL DEFAULT '[]',
  languages             JSONB NOT NULL DEFAULT '["vi"]',
  risk_class            TEXT NOT NULL DEFAULT 'low',
  status                TEXT NOT NULL DEFAULT 'intake',
  owner_user_id         BIGINT,
  data_residency        TEXT,
  related_sales_market_id BIGINT,
  created_by            TEXT,
  updated_by            TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT crm_research_projects_type_chk CHECK (product_type IN (
    'CAT_REVIEW','COMP_LAND','CONSUMER','SEG_STP','BRAND_HEALTH',
    'PRICE_OFFER','CAMPAIGN','TREND_SCAN','GTM','TRACKER')),
  CONSTRAINT crm_research_projects_tier_chk CHECK (dv12_tier IN ('CB','TC','CS')),
  CONSTRAINT crm_research_projects_status_chk CHECK (status IN (
    'intake','designed','collecting','qc','analyzing','synthesizing',
    'drafting','in_review','approved','distributed','archived','cancelled'))
);

CREATE INDEX IF NOT EXISTS crm_research_projects_client_idx
  ON crm_research_projects (client_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS crm_research_questions (
  id            BIGSERIAL PRIMARY KEY,
  project_id    BIGINT NOT NULL REFERENCES crm_research_projects(id) ON DELETE CASCADE,
  sort_order    INT NOT NULL DEFAULT 0,
  question_vi   TEXT NOT NULL,
  question_en   TEXT,
  analysis_frame TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crm_research_sources (
  id                 BIGSERIAL PRIMARY KEY,
  project_id         BIGINT NOT NULL REFERENCES crm_research_projects(id) ON DELETE CASCADE,
  question_id        BIGINT REFERENCES crm_research_questions(id),
  source_type        TEXT NOT NULL DEFAULT 'web',
  title              TEXT NOT NULL,
  publisher          TEXT,
  url                TEXT,
  published_at       DATE,
  accessed_at        DATE,
  geo                TEXT,
  license_note       TEXT,
  reliability_tier   TEXT NOT NULL DEFAULT 'unknown',
  snapshot_uri       TEXT,
  content_hash       TEXT,
  ai_generated       BOOLEAN NOT NULL DEFAULT false,
  keep               BOOLEAN,
  superseded_by      BIGINT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crm_research_evidence (
  id              BIGSERIAL PRIMARY KEY,
  project_id      BIGINT NOT NULL REFERENCES crm_research_projects(id) ON DELETE CASCADE,
  source_id       BIGINT REFERENCES crm_research_sources(id),
  study_id        BIGINT,
  question_id     BIGINT REFERENCES crm_research_questions(id),
  locator         TEXT NOT NULL,
  excerpt         TEXT,
  value_num       NUMERIC,
  unit            TEXT,
  value_base      TEXT,
  period_note     TEXT,
  geography       TEXT,
  captured_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  pii_class       TEXT NOT NULL DEFAULT 'none',
  qc_status       TEXT NOT NULL DEFAULT 'pending',
  checksum        TEXT,
  created_by      TEXT,
  superseded_by   BIGINT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT crm_research_evidence_qc_chk CHECK (qc_status IN (
    'pending','verified','rejected','superseded')),
  CONSTRAINT crm_research_evidence_src_chk CHECK (source_id IS NOT NULL OR study_id IS NOT NULL)
);

-- Unique checksum only among verified rows. Superseded/pending may share a hash
-- after supersede-then-verify of an identical 6-tuple. Existing DBs: see
-- 2026-08-14-postgresql-ddl-market-research-m2.sql (DROP + recreate).
CREATE UNIQUE INDEX IF NOT EXISTS crm_research_evidence_hash_uq
  ON crm_research_evidence (project_id, checksum)
  WHERE qc_status = 'verified' AND checksum IS NOT NULL;

CREATE TABLE IF NOT EXISTS crm_research_insights (
  id                   BIGSERIAL PRIMARY KEY,
  project_id           BIGINT NOT NULL REFERENCES crm_research_projects(id) ON DELETE CASCADE,
  statement            TEXT NOT NULL,
  observation          TEXT,
  interpretation       TEXT,
  implication          TEXT,
  recommendation       TEXT,
  audience             TEXT,
  status               TEXT NOT NULL DEFAULT 'draft',
  confidence_rationale TEXT,
  confidence_json      JSONB,
  ai_generated         BOOLEAN NOT NULL DEFAULT false,
  created_by           TEXT,
  valid_from           DATE,
  valid_to             DATE,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT crm_research_insights_status_chk CHECK (status IN (
    'draft','evidence_attached','analyst_verified','peer_reviewed',
    'approved_internal','approved_client_facing','published',
    'superseded','expired','rejected'))
);

CREATE TABLE IF NOT EXISTS crm_research_insight_evidence (
  insight_id   BIGINT NOT NULL REFERENCES crm_research_insights(id) ON DELETE CASCADE,
  evidence_id  BIGINT NOT NULL REFERENCES crm_research_evidence(id) ON DELETE RESTRICT,
  PRIMARY KEY (insight_id, evidence_id)
);

CREATE TABLE IF NOT EXISTS crm_research_reviews (
  id                 BIGSERIAL PRIMARY KEY,
  project_id         BIGINT NOT NULL REFERENCES crm_research_projects(id) ON DELETE CASCADE,
  object_type        TEXT NOT NULL,
  object_id          BIGINT NOT NULL,
  reviewer           TEXT NOT NULL,
  role               TEXT NOT NULL,
  decision           TEXT NOT NULL,
  comments           TEXT,
  checklist_version  TEXT,
  artifact_hash      TEXT,
  decided_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT crm_research_reviews_obj_chk CHECK (object_type IN ('insight','report','source','project')),
  CONSTRAINT crm_research_reviews_dec_chk CHECK (decision IN (
    'approve','reject','request_changes','risk_accept'))
);

CREATE TABLE IF NOT EXISTS crm_research_reports (
  id          BIGSERIAL PRIMARY KEY,
  project_id  BIGINT NOT NULL REFERENCES crm_research_projects(id) ON DELETE CASCADE,
  template    TEXT NOT NULL DEFAULT 'dv12_cb_v1',
  status      TEXT NOT NULL DEFAULT 'draft',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crm_research_report_versions (
  id                BIGSERIAL PRIMARY KEY,
  report_id         BIGINT NOT NULL REFERENCES crm_research_reports(id) ON DELETE CASCADE,
  version           INT NOT NULL,
  content_snapshot  JSONB NOT NULL,
  generated_by      TEXT,
  content_hash      TEXT NOT NULL,
  embargo_until     TIMESTAMPTZ,
  expires_at        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (report_id, version)
);

CREATE TABLE IF NOT EXISTS crm_research_ai_runs (
  id              BIGSERIAL PRIMARY KEY,
  project_id      BIGINT NOT NULL REFERENCES crm_research_projects(id) ON DELETE CASCADE,
  question_id     BIGINT REFERENCES crm_research_questions(id),
  job_type        TEXT NOT NULL,
  provider        TEXT NOT NULL,
  model           TEXT,
  prompt_version  TEXT,
  status          TEXT NOT NULL DEFAULT 'pending',
  input_hash      TEXT,
  output_json     JSONB,
  error_message   TEXT,
  credits_used    INT NOT NULL DEFAULT 0,
  actor           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at     TIMESTAMPTZ,
  CONSTRAINT crm_research_ai_runs_type_chk CHECK (job_type IN (
    'desk_tavily','deep_research','insight_draft','report_draft','pii_scan'))
);

CREATE INDEX IF NOT EXISTS crm_research_ai_runs_project_idx
  ON crm_research_ai_runs (project_id, created_at DESC);

-- Repo schema_migrations uses (version, description), not (filename).
CREATE TABLE IF NOT EXISTS schema_migrations (
    version     VARCHAR(64) PRIMARY KEY,
    applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    description TEXT
);

INSERT INTO schema_migrations (version, description) VALUES
    (
        '2026-08-14-market-research',
        'Market Research OS P0: 10 crm_research_* tables'
    )
ON CONFLICT (version) DO NOTHING;
