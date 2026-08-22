-- Video SOP S9: delivery packages + client review links

CREATE TABLE IF NOT EXISTS vd_delivery_packages (
  id               bigserial PRIMARY KEY,
  project_id       bigint NOT NULL REFERENCES vd_projects(id),
  zip_storage_key  text NOT NULL DEFAULT '',
  file_names_json  jsonb NOT NULL DEFAULT '[]',
  meta_json        jsonb NOT NULL DEFAULT '{}',
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS vd_delivery_packages_project_created_idx
  ON vd_delivery_packages (project_id, created_at DESC);

CREATE TABLE IF NOT EXISTS vd_review_links (
  id               bigserial PRIMARY KEY,
  token            text NOT NULL UNIQUE,
  project_id       bigint NOT NULL REFERENCES vd_projects(id),
  gate_no          int NOT NULL CHECK (gate_no IN (1, 4)),
  asset_ids        jsonb NOT NULL DEFAULT '[]',
  expires_at       timestamptz NOT NULL,
  watermark_label  text NOT NULL DEFAULT '',
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS vd_review_links_project_idx
  ON vd_review_links (project_id, created_at DESC);

CREATE TABLE IF NOT EXISTS vd_review_comments (
  id               bigserial PRIMARY KEY,
  link_id          bigint NOT NULL REFERENCES vd_review_links(id) ON DELETE CASCADE,
  body             text NOT NULL,
  timecode_ms      int,
  pin_x            numeric,
  pin_y            numeric,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS vd_review_comments_link_idx
  ON vd_review_comments (link_id, created_at ASC);
