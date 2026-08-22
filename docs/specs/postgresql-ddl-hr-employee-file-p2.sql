-- HR Employee File OS — P2: labor contracts + appendices
-- Apply: scripts/apply_pg_ddl_hr_employee_file_p2.sh

BEGIN;

CREATE TABLE IF NOT EXISTS hr_labor_contracts (
  id BIGSERIAL PRIMARY KEY,
  staff_id BIGINT NOT NULL REFERENCES crm_staff(id) ON DELETE CASCADE,
  contract_no TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL DEFAULT 'fixed'
    CHECK (kind IN ('probation', 'fixed', 'indefinite', 'seasonal', 'service')),
  signed_on DATE,
  effective_on DATE,
  expires_on DATE,
  salary_gross NUMERIC(18, 2),
  currency TEXT NOT NULL DEFAULT 'VND',
  work_place TEXT NOT NULL DEFAULT '',
  job_title_legal TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'expired', 'terminated', 'superseded')),
  document_id BIGINT REFERENCES hr_doc_wallet(id) ON DELETE SET NULL,
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_hr_labor_contracts_no
  ON hr_labor_contracts (contract_no)
  WHERE contract_no <> '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_hr_labor_contracts_one_active
  ON hr_labor_contracts (staff_id)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_hr_labor_contracts_staff
  ON hr_labor_contracts (staff_id, effective_on DESC, id DESC);

CREATE TABLE IF NOT EXISTS hr_labor_contract_appendices (
  id BIGSERIAL PRIMARY KEY,
  contract_id BIGINT NOT NULL REFERENCES hr_labor_contracts(id) ON DELETE CASCADE,
  appendix_no TEXT NOT NULL DEFAULT '',
  signed_on DATE,
  effective_on DATE,
  summary TEXT NOT NULL DEFAULT '',
  salary_gross NUMERIC(18, 2),
  document_id BIGINT REFERENCES hr_doc_wallet(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hr_labor_appendices_contract
  ON hr_labor_contract_appendices (contract_id, effective_on DESC, id DESC);

INSERT INTO schema_migrations (version, description)
VALUES ('hr-employee-file-p2', 'HR Employee File P2 — labor contracts')
ON CONFLICT (version) DO NOTHING;

COMMIT;
