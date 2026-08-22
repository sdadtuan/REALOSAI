-- HR Employee File OS — P6: self-submit wallet + approval audit columns
-- Apply: scripts/apply_pg_ddl_hr_employee_file_p6.sh

BEGIN;

ALTER TABLE hr_doc_wallet
  ADD COLUMN IF NOT EXISTS submitted_by TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS reviewed_by TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_hr_doc_wallet_pending
  ON hr_doc_wallet (staff_id, status)
  WHERE deleted_at IS NULL AND status = 'pending_review';

INSERT INTO schema_migrations (version, description)
VALUES ('hr-employee-file-p6', 'HR Employee File P6 — wallet self-submit audit columns')
ON CONFLICT (version) DO NOTHING;

COMMIT;
