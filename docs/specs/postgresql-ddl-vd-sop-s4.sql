-- Video SOP S4: style + character bibles

CREATE TABLE IF NOT EXISTS vd_style_bibles (
  id              bigserial PRIMARY KEY,
  project_id      bigint NOT NULL REFERENCES vd_projects(id),
  body_json       jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS vd_style_bibles_project_uidx
  ON vd_style_bibles (project_id);

CREATE TABLE IF NOT EXISTS vd_character_bibles (
  id              bigserial PRIMARY KEY,
  project_id      bigint NOT NULL REFERENCES vd_projects(id),
  body_json       jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS vd_character_bibles_project_uidx
  ON vd_character_bibles (project_id);
