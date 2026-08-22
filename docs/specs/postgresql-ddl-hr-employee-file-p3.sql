-- HR Employee File OS — P3: insurance register (BHXH / BHYT / BHTN)
-- Apply: scripts/apply_pg_ddl_hr_employee_file_p3.sh

BEGIN;

CREATE TABLE IF NOT EXISTS hr_staff_insurance (
  staff_id BIGINT PRIMARY KEY REFERENCES crm_staff(id) ON DELETE CASCADE,
  bhxh_book_no TEXT NOT NULL DEFAULT '',
  bhxh_joined_on DATE,
  bhxh_status TEXT NOT NULL DEFAULT 'active'
    CHECK (bhxh_status IN ('active', 'paused', 'closed')),
  bhxh_document_id BIGINT REFERENCES hr_doc_wallet(id) ON DELETE SET NULL,
  bhyt_card_no TEXT NOT NULL DEFAULT '',
  bhyt_valid_from DATE,
  bhyt_valid_to DATE,
  bhyt_clinic_name TEXT NOT NULL DEFAULT '',
  bhyt_document_id BIGINT REFERENCES hr_doc_wallet(id) ON DELETE SET NULL,
  bhtn_joined_on DATE,
  bhtn_status TEXT NOT NULL DEFAULT 'active'
    CHECK (bhtn_status IN ('active', 'paused', 'closed')),
  bhtn_document_id BIGINT REFERENCES hr_doc_wallet(id) ON DELETE SET NULL,
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hr_insurance_periods (
  id BIGSERIAL PRIMARY KEY,
  staff_id BIGINT NOT NULL REFERENCES crm_staff(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('bhxh', 'bhtn')),
  period_year INT NOT NULL CHECK (period_year >= 2000 AND period_year <= 2100),
  period_month INT NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  salary_base NUMERIC(18, 2),
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_hr_insurance_periods_unique
  ON hr_insurance_periods (staff_id, kind, period_year, period_month);

CREATE INDEX IF NOT EXISTS idx_hr_insurance_periods_staff
  ON hr_insurance_periods (staff_id, period_year DESC, period_month DESC, id DESC);

INSERT INTO schema_migrations (version, description)
VALUES ('hr-employee-file-p3', 'HR Employee File P3 — insurance register')
ON CONFLICT (version) DO NOTHING;

COMMIT;
