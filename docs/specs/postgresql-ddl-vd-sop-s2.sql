-- Video SOP S2: jobs, providers, models, assets, asset lineage, llm runs

CREATE TABLE IF NOT EXISTS vd_providers (
  id              bigserial PRIMARY KEY,
  code            text NOT NULL UNIQUE
                    CHECK (code IN (
                      'leonardo','flux','kling','runway','topaz','openai','ffmpeg'
                    )),
  label           text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS vd_models (
  id              bigserial PRIMARY KEY,
  provider_id     bigint NOT NULL REFERENCES vd_providers(id),
  code            text NOT NULL,
  capability_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS vd_models_provider_code_uidx
  ON vd_models (provider_id, code);

CREATE TABLE IF NOT EXISTS vd_jobs (
  id              bigserial PRIMARY KEY,
  project_id      bigint NOT NULL REFERENCES vd_projects(id),
  shot_id         bigint,
  queue           text NOT NULL
                    CHECK (queue IN (
                      'q.text','q.image','q.video.kling','q.video.runway',
                      'q.enhance','q.media','q.notify'
                    )),
  job_type        text NOT NULL,
  status          text NOT NULL DEFAULT 'queued'
                    CHECK (status IN (
                      'created','queued','running','succeeded','failed','cancelled','stale'
                    )),
  error_class     text
                    CHECK (error_class IS NULL OR error_class IN (
                      'auth','transient','rate_limit','validation','provider','unknown'
                    )),
  attempt         int NOT NULL DEFAULT 0,
  idempotency_key text NOT NULL UNIQUE,
  input_json      jsonb NOT NULL DEFAULT '{}'::jsonb,
  output_json     jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS vd_jobs_project_idx ON vd_jobs (project_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS vd_jobs_status_idx ON vd_jobs (status) WHERE status IN ('queued','running');

CREATE TABLE IF NOT EXISTS vd_assets (
  id              bigserial PRIMARY KEY,
  project_id      bigint NOT NULL REFERENCES vd_projects(id),
  job_id          bigint REFERENCES vd_jobs(id),
  kind            text NOT NULL
                    CHECK (kind IN ('keyframe','take','master','proxy','package')),
  storage_key     text NOT NULL DEFAULT '',
  url             text NOT NULL DEFAULT '',
  sha256          text,
  width           int,
  height          int,
  duration_ms     int,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS vd_assets_project_idx ON vd_assets (project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS vd_assets_job_idx ON vd_assets (job_id) WHERE job_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS vd_asset_lineage (
  id              bigserial PRIMARY KEY,
  parent_asset_id bigint NOT NULL REFERENCES vd_assets(id),
  child_asset_id  bigint NOT NULL REFERENCES vd_assets(id),
  edge            text NOT NULL
                    CHECK (edge IN ('prompt','img2vid','upscale','concat')),
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS vd_asset_lineage_edge_uidx
  ON vd_asset_lineage (parent_asset_id, child_asset_id, edge);

CREATE TABLE IF NOT EXISTS vd_llm_runs (
  id              bigserial PRIMARY KEY,
  project_id      bigint NOT NULL REFERENCES vd_projects(id),
  template_code   text NOT NULL,
  input_json      jsonb NOT NULL DEFAULT '{}'::jsonb,
  output_json     jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS vd_llm_runs_project_idx ON vd_llm_runs (project_id, created_at DESC);

-- Seed ffmpeg provider + media model (S2 IMediaOps stub)
INSERT INTO vd_providers (code, label)
VALUES ('ffmpeg', 'FFmpeg IMediaOps')
ON CONFLICT (code) DO NOTHING;

INSERT INTO vd_models (provider_id, code, capability_json)
SELECT p.id, 'ffmpeg', '{"kind":"media"}'::jsonb
FROM vd_providers p
WHERE p.code = 'ffmpeg'
ON CONFLICT (provider_id, code) DO NOTHING;
