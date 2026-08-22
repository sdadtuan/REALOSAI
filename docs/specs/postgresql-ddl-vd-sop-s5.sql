-- Video SOP S5: gates, approvals, rework

CREATE TABLE IF NOT EXISTS vd_gates (
  id              bigserial PRIMARY KEY,
  project_id      bigint NOT NULL REFERENCES vd_projects(id),
  gate_no         int NOT NULL CHECK (gate_no BETWEEN 1 AND 4),
  status          text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS vd_gates_project_gate_uidx
  ON vd_gates (project_id, gate_no);

CREATE TABLE IF NOT EXISTS vd_approvals (
  id              bigserial PRIMARY KEY,
  gate_id         bigint NOT NULL REFERENCES vd_gates(id),
  actor_email     text NOT NULL DEFAULT '',
  action          text NOT NULL CHECK (action IN ('approve', 'reject', 'override')),
  reason          text NOT NULL DEFAULT '',
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS vd_approvals_gate_idx ON vd_approvals (gate_id, created_at DESC);

CREATE TABLE IF NOT EXISTS vd_rework_items (
  id              bigserial PRIMARY KEY,
  project_id      bigint NOT NULL REFERENCES vd_projects(id),
  gate_no         int NOT NULL CHECK (gate_no BETWEEN 1 AND 4),
  reason          text NOT NULL DEFAULT '',
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS vd_rework_items_project_idx ON vd_rework_items (project_id, created_at DESC);
