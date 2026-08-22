-- Video SOP S3: ideas, shots, prompts, prompt templates

CREATE TABLE IF NOT EXISTS vd_ideas (
  id              bigserial PRIMARY KEY,
  project_id      bigint NOT NULL REFERENCES vd_projects(id),
  ordinal         int NOT NULL CHECK (ordinal BETWEEN 1 AND 3),
  summary         text NOT NULL,
  selected        boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS vd_ideas_project_ordinal_uidx
  ON vd_ideas (project_id, ordinal);

CREATE TABLE IF NOT EXISTS vd_shots (
  id              bigserial PRIMARY KEY,
  script_id       bigint NOT NULL REFERENCES vd_scripts(id),
  ordinal         int NOT NULL,
  status          text NOT NULL DEFAULT 'draft'
                    CHECK (status IN (
                      'draft','prompts_ready','keyframe_pending','keyframe_approved',
                      'clip_draft','clip_final','clip_selected','posted','blocked','plan_b'
                    )),
  duration_ms     int NOT NULL,
  camera          text NOT NULL DEFAULT '',
  action          text NOT NULL DEFAULT '',
  aspect          text NOT NULL DEFAULT '9:16',
  contains_human  boolean NOT NULL DEFAULT false,
  text_in_frame   boolean NOT NULL DEFAULT false,
  logo_in_ai_frame boolean NOT NULL DEFAULT false,
  seed            bigint,
  take_fail_count int NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX IF NOT EXISTS vd_shots_script_ordinal_uidx
  ON vd_shots (script_id, ordinal);

CREATE TABLE IF NOT EXISTS vd_prompts (
  id                  bigserial PRIMARY KEY,
  shot_id             bigint NOT NULL REFERENCES vd_shots(id),
  body                text NOT NULL DEFAULT '',
  bible_snapshot_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  region_locked       boolean NOT NULL DEFAULT false,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS vd_prompt_templates (
  id              bigserial PRIMARY KEY,
  code            text NOT NULL UNIQUE,
  kind            text NOT NULL
                    CHECK (kind IN ('brief','director','shot','keyframe','motion')),
  body            text NOT NULL DEFAULT '',
  created_at      timestamptz NOT NULL DEFAULT now()
);

INSERT INTO vd_prompt_templates (code, kind, body) VALUES
  ('vd.brief.v1', 'brief', 'Điền 8 nhóm SOP 1.1'),
  ('vd.director.v1', 'director', 'Sinh 3 ý tưởng video 15–60s'),
  ('vd.shot.v1', 'shot', 'Shot: camera + action, không chữ trong frame'),
  ('vd.keyframe.v1', 'keyframe', 'Keyframe cinematic, lock region bible'),
  ('vd.motion.v1', 'motion', 'Motion brief — S6')
ON CONFLICT (code) DO NOTHING;
