-- Social FFmpeg V1 job types (cmkt_content_jobs CHECK)
ALTER TABLE cmkt_content_jobs DROP CONSTRAINT IF EXISTS cmkt_content_jobs_type_check;
ALTER TABLE cmkt_content_jobs ADD CONSTRAINT cmkt_content_jobs_type_check CHECK (
    job_type IN (
        'idea_batch',
        'ideas_bulk',
        'draft_generate',
        'variant_generate',
        'repurpose',
        'optimize_hook',
        'weekly_memo',
        'intelligence_digest',
        'topic_suggest',
        'image_generate',
        'carousel_slides_generate',
        'video_short_generate',
        'visual_qa_score',
        'social_storyboard',
        'social_render',
        'social_transcode',
        'social_qa'
    )
);

CREATE TABLE IF NOT EXISTS cmkt_video_licenses (
  id              bigserial PRIMARY KEY,
  lifecycle_id    bigint NOT NULL,
  item_id         bigint NOT NULL,
  asset_kind      text NOT NULL CHECK (asset_kind IN ('stock_clip', 'music_bed', 'tts', 'logo', 'upload')),
  provider        text NOT NULL,
  provider_id     text,
  license_name    text NOT NULL,
  source_url      text,
  local_storage_key text,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cmkt_video_licenses_item_idx ON cmkt_video_licenses (item_id);
