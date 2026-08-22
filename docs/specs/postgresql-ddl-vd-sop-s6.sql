-- Video SOP S6: take scores + project budget alert threshold

CREATE TABLE IF NOT EXISTS vd_take_scores (
  id              bigserial PRIMARY KEY,
  asset_id        bigint NOT NULL REFERENCES vd_assets(id),
  shot_id         bigint NOT NULL REFERENCES vd_shots(id),
  verdict         text NOT NULL CHECK (verdict IN ('passed', 'failed')),
  artifact_json   jsonb NOT NULL DEFAULT '{}',
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS vd_take_scores_shot_idx ON vd_take_scores (shot_id, created_at DESC);
CREATE INDEX IF NOT EXISTS vd_take_scores_asset_idx ON vd_take_scores (asset_id);

CREATE TABLE IF NOT EXISTS vd_budgets (
  project_id        bigint PRIMARY KEY REFERENCES vd_projects(id),
  alert_threshold   numeric NOT NULL DEFAULT 100,
  updated_at        timestamptz NOT NULL DEFAULT now()
);
