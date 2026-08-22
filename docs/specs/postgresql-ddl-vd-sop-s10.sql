-- Video SOP S10: production benchmarks

CREATE TABLE IF NOT EXISTS vd_benchmarks (
  id              bigserial PRIMARY KEY,
  project_id      bigint NOT NULL REFERENCES vd_projects(id),
  metric          text NOT NULL CHECK (metric IN (
    'kf_pass_rate', 'clip_pass_rate', 'takes_per_shot',
    'credit_ratio', 'client_rounds', 'lead_days', 'override_rate'
  )),
  value           numeric NOT NULL DEFAULT 0,
  computed_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS vd_benchmarks_project_metric_idx
  ON vd_benchmarks (project_id, metric, computed_at DESC);
