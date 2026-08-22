CREATE TABLE IF NOT EXISTS vd_projects (
  id              bigserial PRIMARY KEY,
  lifecycle_id    bigint NOT NULL,
  client_id       text,
  cmkt_item_id    bigint,
  title           text NOT NULL,
  stage           text NOT NULL DEFAULT 'brief_draft'
                    CHECK (stage IN (
                      'brief_draft','brief_ready','ideation','scripting','shotlist_ready',
                      'keyframing','animating','post_production','delivered','archived'
                    )),
  status          text NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active','on_hold','cancelled')),
  created_by      text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS vd_projects_cmkt_item_uidx
  ON vd_projects (cmkt_item_id) WHERE cmkt_item_id IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS vd_projects_lifecycle_idx ON vd_projects (lifecycle_id) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS vd_briefs (
  id              bigserial PRIMARY KEY,
  project_id      bigint NOT NULL REFERENCES vd_projects(id),
  body_json       jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS vd_briefs_project_uidx ON vd_briefs (project_id);

CREATE TABLE IF NOT EXISTS vd_scripts (
  id              bigserial PRIMARY KEY,
  project_id      bigint NOT NULL REFERENCES vd_projects(id),
  version         int NOT NULL DEFAULT 1,
  markdown        text NOT NULL DEFAULT '',
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS vd_audit_logs (
  id              bigserial PRIMARY KEY,
  project_id      bigint NOT NULL REFERENCES vd_projects(id),
  actor_email     text NOT NULL,
  action          text NOT NULL,
  payload_json    jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS vd_audit_project_idx ON vd_audit_logs (project_id, created_at DESC);
