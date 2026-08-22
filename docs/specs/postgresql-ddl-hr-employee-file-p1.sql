-- HR Employee File OS — P1: identity + addresses
-- Apply: scripts/apply_pg_ddl_hr_employee_file_p1.sh

BEGIN;

CREATE TABLE IF NOT EXISTS hr_staff_identity (
  staff_id BIGINT PRIMARY KEY REFERENCES crm_staff(id) ON DELETE CASCADE,
  legal_name TEXT NOT NULL DEFAULT '',
  dob DATE,
  gender TEXT NOT NULL DEFAULT '',
  nationality TEXT NOT NULL DEFAULT 'VN',
  cccd TEXT NOT NULL DEFAULT '',
  cccd_issued_on DATE,
  cccd_issued_by TEXT NOT NULL DEFAULT '',
  tax_code TEXT NOT NULL DEFAULT '',
  bank_name TEXT NOT NULL DEFAULT '',
  bank_account TEXT NOT NULL DEFAULT '',
  bank_holder TEXT NOT NULL DEFAULT '',
  timeclock_pin TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_hr_staff_identity_cccd
  ON hr_staff_identity (cccd)
  WHERE cccd <> '';

CREATE TABLE IF NOT EXISTS hr_staff_addresses (
  id BIGSERIAL PRIMARY KEY,
  staff_id BIGINT NOT NULL REFERENCES crm_staff(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('permanent', 'temporary', 'contact')),
  province_code TEXT NOT NULL DEFAULT '',
  district_code TEXT NOT NULL DEFAULT '',
  ward_code TEXT NOT NULL DEFAULT '',
  line1 TEXT NOT NULL DEFAULT '',
  same_as_permanent BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_hr_staff_addresses_staff_kind
  ON hr_staff_addresses (staff_id, kind);

CREATE TABLE IF NOT EXISTS hr_staff_pii_audit (
  id BIGSERIAL PRIMARY KEY,
  staff_id BIGINT NOT NULL,
  actor_user_id UUID,
  actor_email TEXT NOT NULL DEFAULT '',
  action TEXT NOT NULL,
  section TEXT NOT NULL DEFAULT '',
  meta_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hr_staff_pii_audit_staff
  ON hr_staff_pii_audit (staff_id, created_at DESC);

CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  description TEXT NOT NULL DEFAULT '',
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO schema_migrations (version, description)
VALUES ('hr-employee-file-p1', 'HR Employee File P1 — identity + addresses')
ON CONFLICT (version) DO NOTHING;

COMMIT;
