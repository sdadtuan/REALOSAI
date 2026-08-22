-- Video SOP S7: extend vd_budgets + cost ledger

ALTER TABLE vd_budgets ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'USD';
ALTER TABLE vd_budgets ADD COLUMN IF NOT EXISTS limit_amount numeric NOT NULL DEFAULT 100;
ALTER TABLE vd_budgets ADD COLUMN IF NOT EXISTS buffer_factor numeric NOT NULL DEFAULT 1.5;
ALTER TABLE vd_budgets ADD COLUMN IF NOT EXISTS overshoot_factor numeric NOT NULL DEFAULT 2.5;

CREATE TABLE IF NOT EXISTS vd_cost_ledger (
  id              bigserial PRIMARY KEY,
  project_id      bigint NOT NULL REFERENCES vd_projects(id),
  job_id          bigint REFERENCES vd_jobs(id),
  kind            text NOT NULL CHECK (kind IN ('estimated', 'actual')),
  amount          numeric NOT NULL,
  vendor          text NOT NULL DEFAULT '',
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS vd_cost_ledger_project_idx ON vd_cost_ledger (project_id, created_at DESC);
