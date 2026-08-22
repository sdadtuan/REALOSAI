-- Video SOP S11: L5 capability registry — widen vd_jobs, provider ref, webhook dedupe, seed 8 model_key

ALTER TABLE vd_jobs DROP CONSTRAINT IF EXISTS vd_jobs_status_check;
ALTER TABLE vd_jobs ADD CONSTRAINT vd_jobs_status_check CHECK (status IN (
  'created','queued','submitted','running','succeeded','failed','cancelled','stale','expired'
));

ALTER TABLE vd_jobs DROP CONSTRAINT IF EXISTS vd_jobs_error_class_check;
ALTER TABLE vd_jobs ADD CONSTRAINT vd_jobs_error_class_check CHECK (
  error_class IS NULL OR error_class IN (
    'auth','validation','budget','rate_limit','moderation','input_asset',
    'capability','transient','timeout','not_ready','provider','unknown'
  )
);

ALTER TABLE vd_jobs ADD COLUMN IF NOT EXISTS provider_code text;
ALTER TABLE vd_jobs ADD COLUMN IF NOT EXISTS provider_task_id text;
ALTER TABLE vd_jobs ADD COLUMN IF NOT EXISTS model_key text;
ALTER TABLE vd_jobs ADD COLUMN IF NOT EXISTS request_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS vd_job_provider_ref (
  job_id bigint PRIMARY KEY REFERENCES vd_jobs(id),
  provider_code text NOT NULL,
  provider_task_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider_code, provider_task_id)
);

CREATE TABLE IF NOT EXISTS vd_webhook_events (
  id bigserial PRIMARY KEY,
  provider_code text NOT NULL,
  event_id text NOT NULL,
  job_id bigint REFERENCES vd_jobs(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider_code, event_id)
);

-- Seed providers if missing
INSERT INTO vd_providers (code, label) VALUES
  ('leonardo', 'Leonardo AI'),
  ('kling', 'Kling'),
  ('runway', 'Runway'),
  ('topaz', 'Topaz Labs'),
  ('openai', 'OpenAI')
ON CONFLICT (code) DO NOTHING;

-- Seed 8 model_key (code = model_key)
INSERT INTO vd_models (provider_id, code, capability_json)
SELECT p.id, 'text.openai.script', '{
  "capability": "TEXT_GEN",
  "route": "DIRECT",
  "provider_model_id": "gpt-5.6",
  "constraints": {},
  "price": { "unit": "TOKEN", "rate": null, "currency": "USD", "verified_at": "2026-08-20" },
  "async": { "mode": "WEBHOOK", "poll_sec": 2, "webhook": true },
  "status": "ACTIVE",
  "verified_at": "2026-08-20"
}'::jsonb
FROM vd_providers p WHERE p.code = 'openai'
ON CONFLICT (provider_id, code) DO NOTHING;

INSERT INTO vd_models (provider_id, code, capability_json)
SELECT p.id, 'image.leonardo.lucid_origin', '{
  "capability": "IMAGE_GEN",
  "route": "DIRECT",
  "provider_model_id": "lucid-origin",
  "constraints": {},
  "price": { "unit": "IMAGE", "rate": null, "currency": "USD", "verified_at": "2026-08-20" },
  "async": { "mode": "WEBHOOK", "poll_sec": 10, "webhook": true },
  "status": "ACTIVE",
  "verified_at": "2026-08-20"
}'::jsonb
FROM vd_providers p WHERE p.code = 'leonardo'
ON CONFLICT (provider_id, code) DO NOTHING;

INSERT INTO vd_models (provider_id, code, capability_json)
SELECT p.id, 'enhance.leonardo.upscale_precise', '{
  "capability": "ENHANCE_IMAGE",
  "route": "DIRECT",
  "provider_model_id": "aurora-upscaler-precise",
  "constraints": {},
  "price": { "unit": "IMAGE", "rate": null, "currency": "USD", "verified_at": "2026-08-20" },
  "async": { "mode": "WEBHOOK", "poll_sec": 10, "webhook": true },
  "status": "ACTIVE",
  "verified_at": "2026-08-20"
}'::jsonb
FROM vd_providers p WHERE p.code = 'leonardo'
ON CONFLICT (provider_id, code) DO NOTHING;

INSERT INTO vd_models (provider_id, code, capability_json)
SELECT p.id, 'video.kling.v3.pro', '{
  "capability": "VIDEO_GEN",
  "route": "VIA_LEONARDO",
  "provider_model_id": "kling-3.0",
  "constraints": { "duration_sec": { "min": 3, "max": 15 } },
  "price": { "unit": "SECOND", "rate": null, "currency": "USD", "verified_at": "2026-08-20" },
  "async": { "mode": "WEBHOOK", "poll_sec": 10, "webhook": true },
  "status": "ACTIVE",
  "verified_at": "2026-08-20"
}'::jsonb
FROM vd_providers p WHERE p.code = 'kling'
ON CONFLICT (provider_id, code) DO NOTHING;

INSERT INTO vd_models (provider_id, code, capability_json)
SELECT p.id, 'video.runway.gen45', '{
  "capability": "VIDEO_GEN",
  "route": "DIRECT",
  "provider_model_id": "gen4.5",
  "constraints": { "duration_sec": { "min": 2, "max": 10 } },
  "price": { "unit": "CREDIT", "rate": 12, "currency": "USD", "verified_at": "2026-08-20", "min_charge": 56, "usd_per_credit": 0.01 },
  "async": { "mode": "POLL", "poll_sec": 5, "webhook": false, "api_version": "2024-11-06" },
  "status": "ACTIVE",
  "verified_at": "2026-08-20"
}'::jsonb
FROM vd_providers p WHERE p.code = 'runway'
ON CONFLICT (provider_id, code) DO NOTHING;

INSERT INTO vd_models (provider_id, code, capability_json)
SELECT p.id, 'video.runway.gen4_turbo_draft', '{
  "capability": "VIDEO_GEN",
  "route": "DIRECT",
  "provider_model_id": "gen4_turbo",
  "constraints": { "duration_sec": { "min": 2, "max": 10 } },
  "price": { "unit": "CREDIT", "rate": 5, "currency": "USD", "verified_at": "2026-08-20", "usd_per_credit": 0.01 },
  "async": { "mode": "POLL", "poll_sec": 5, "webhook": false, "api_version": "2024-11-06" },
  "status": "ACTIVE",
  "verified_at": "2026-08-20"
}'::jsonb
FROM vd_providers p WHERE p.code = 'runway'
ON CONFLICT (provider_id, code) DO NOTHING;

INSERT INTO vd_models (provider_id, code, capability_json)
SELECT p.id, 'enhance.topaz.image_gigapixel', '{
  "capability": "ENHANCE_IMAGE",
  "route": "DIRECT",
  "provider_model_id": "Standard V2",
  "constraints": {},
  "price": { "unit": "IMAGE", "rate": null, "currency": "USD", "verified_at": "2026-08-20" },
  "async": { "mode": "POLL", "poll_sec": 2, "webhook": false },
  "status": "ACTIVE",
  "verified_at": "2026-08-20"
}'::jsonb
FROM vd_providers p WHERE p.code = 'topaz'
ON CONFLICT (provider_id, code) DO NOTHING;

INSERT INTO vd_models (provider_id, code, capability_json)
SELECT p.id, 'enhance.topaz.video_starlight_quality', '{
  "capability": "ENHANCE_VIDEO",
  "route": "DIRECT",
  "provider_model_id": "rhea-1",
  "constraints": {},
  "price": { "unit": "SECOND", "rate": null, "currency": "USD", "verified_at": "2026-08-20" },
  "async": { "mode": "POLL", "poll_sec": 2, "webhook": false },
  "status": "ACTIVE",
  "verified_at": "2026-08-20"
}'::jsonb
FROM vd_providers p WHERE p.code = 'topaz'
ON CONFLICT (provider_id, code) DO NOTHING;
