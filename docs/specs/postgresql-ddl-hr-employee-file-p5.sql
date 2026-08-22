-- HR Employee File OS — P5: dependents + staff lifecycle
-- Apply: scripts/apply_pg_ddl_hr_employee_file_p5.sh

BEGIN;

CREATE TABLE IF NOT EXISTS hr_staff_dependents (
  id BIGSERIAL PRIMARY KEY,
  staff_id BIGINT NOT NULL REFERENCES crm_staff(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  relation TEXT NOT NULL DEFAULT '',
  dob DATE,
  tax_dependent BOOLEAN NOT NULL DEFAULT FALSE,
  cccd TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hr_staff_dependents_staff
  ON hr_staff_dependents (staff_id, id DESC);

CREATE TABLE IF NOT EXISTS hr_staff_lifecycle (
  staff_id BIGINT PRIMARY KEY REFERENCES crm_staff(id) ON DELETE CASCADE,
  stage TEXT NOT NULL DEFAULT 'offer'
    CHECK (stage IN (
      'offer', 'onboard_docs', 'probation', 'official',
      'transfer', 'notice', 'offboard_hold', 'archived'
    )),
  stage_changed_on DATE,
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO schema_migrations (version, description)
VALUES ('hr-employee-file-p5', 'HR Employee File P5 — dependents + lifecycle')
ON CONFLICT (version) DO NOTHING;

COMMIT;
