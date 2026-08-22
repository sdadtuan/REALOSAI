-- HR Employee File OS — P4: document wallet
-- Apply: scripts/apply_pg_ddl_hr_employee_file_p4.sh

BEGIN;

CREATE TABLE IF NOT EXISTS hr_doc_types (
  type_code TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'other',
  is_system BOOLEAN NOT NULL DEFAULT TRUE,
  is_required_onboard BOOLEAN NOT NULL DEFAULT FALSE,
  is_required_official BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hr_doc_wallet (
  id BIGSERIAL PRIMARY KEY,
  staff_id BIGINT NOT NULL REFERENCES crm_staff(id) ON DELETE CASCADE,
  type_code TEXT NOT NULL REFERENCES hr_doc_types(type_code),
  title TEXT NOT NULL DEFAULT '',
  doc_no TEXT NOT NULL DEFAULT '',
  issuer TEXT NOT NULL DEFAULT '',
  issued_on DATE,
  expires_on DATE,
  status TEXT NOT NULL DEFAULT 'valid',
  visibility TEXT NOT NULL DEFAULT 'hr_only',
  pinned BOOLEAN NOT NULL DEFAULT FALSE,
  linked_entity TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hr_doc_wallet_staff ON hr_doc_wallet (staff_id, deleted_at NULLS FIRST, pinned DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_hr_doc_wallet_expires ON hr_doc_wallet (expires_on) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS hr_doc_wallet_education (
  card_id BIGINT PRIMARY KEY REFERENCES hr_doc_wallet(id) ON DELETE CASCADE,
  level TEXT NOT NULL DEFAULT '',
  major TEXT NOT NULL DEFAULT '',
  school TEXT NOT NULL DEFAULT '',
  graduated_on DATE,
  classification TEXT NOT NULL DEFAULT '',
  training_form TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS hr_doc_wallet_files (
  id BIGSERIAL PRIMARY KEY,
  card_id BIGINT NOT NULL REFERENCES hr_doc_wallet(id) ON DELETE CASCADE,
  storage_key TEXT NOT NULL,
  original_name TEXT NOT NULL DEFAULT '',
  mime_type TEXT NOT NULL DEFAULT '',
  size_bytes BIGINT NOT NULL DEFAULT 0,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hr_doc_wallet_files_card ON hr_doc_wallet_files (card_id, deleted_at NULLS FIRST);

INSERT INTO hr_doc_types (type_code, label, category, is_required_onboard, sort_order) VALUES
  ('cccd_front', 'CCCD mặt trước', 'identity', TRUE, 10),
  ('cccd_back', 'CCCD mặt sau', 'identity', TRUE, 11),
  ('passport', 'Hộ chiếu', 'identity', FALSE, 12),
  ('cv_resume', 'CV / Resume', 'identity', FALSE, 13),
  ('labor_contract', 'Hợp đồng lao động', 'contract', TRUE, 20),
  ('contract_appendix', 'Phụ lục HĐ', 'contract', FALSE, 21),
  ('nda', 'NDA / Cam kết BM', 'contract', FALSE, 22),
  ('offer_letter', 'Offer letter', 'contract', FALSE, 23),
  ('bhxh_book', 'Sổ BHXH', 'insurance', FALSE, 30),
  ('bhyt_card', 'Thẻ BHYT', 'insurance', FALSE, 31),
  ('bhtn', 'BHTN', 'insurance', FALSE, 32),
  ('degree_highschool', 'Bằng THPT', 'education', FALSE, 40),
  ('degree_college', 'Bằng Trung cấp / CĐ', 'education', FALSE, 41),
  ('degree_bachelor', 'Bằng Đại học', 'education', FALSE, 42),
  ('degree_master', 'Bằng Thạc sĩ', 'education', FALSE, 43),
  ('degree_phd', 'Bằng Tiến sĩ', 'education', FALSE, 44),
  ('cert_language', 'Chứng chỉ ngoại ngữ', 'cert', FALSE, 50),
  ('cert_it', 'Chứng chỉ IT', 'cert', FALSE, 51),
  ('cert_professional', 'Chứng chỉ nghề', 'cert', FALSE, 52),
  ('cert_other', 'Chứng chỉ khác', 'cert', FALSE, 53),
  ('driver_license', 'GPLX', 'license', FALSE, 60),
  ('work_permit', 'Giấy phép lao động', 'license', FALSE, 61),
  ('health_check', 'Giấy khám sức khỏe', 'medical', FALSE, 70),
  ('vaccination', 'Tiêm chủng', 'medical', FALSE, 71),
  ('dependent_birth_cert', 'Giấy khai sinh NPT', 'family', FALSE, 80),
  ('marriage_cert', 'Giấy đăng ký kết hôn', 'family', FALSE, 81),
  ('other', 'Khác', 'other', FALSE, 99)
ON CONFLICT (type_code) DO NOTHING;

INSERT INTO schema_migrations (version, description)
VALUES ('hr-employee-file-p4', 'HR Employee File P4 — document wallet')
ON CONFLICT (version) DO NOTHING;

COMMIT;
