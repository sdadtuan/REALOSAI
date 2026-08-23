-- Zero SQLite Wave 1 P1 — customers, cases, tickets (CSKH)
-- Prerequisite: docs/specs/2026-08-02-wave-b5-pg-oltp-bridge.sql applied
BEGIN;

ALTER TABLE crm_customers
  ADD COLUMN IF NOT EXISTS lead_source TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS lead_source_note TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS date_of_birth TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS gender TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS id_number TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS occupation TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS interests TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS profile_notes TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS crm_customer_relations (
  id BIGSERIAL PRIMARY KEY,
  sqlite_relation_id BIGINT UNIQUE,
  customer_id BIGINT NOT NULL REFERENCES crm_customers (id) ON DELETE CASCADE,
  relation_type TEXT NOT NULL DEFAULT 'other',
  full_name TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS crm_customer_purchases (
  id BIGSERIAL PRIMARY KEY,
  sqlite_purchase_id BIGINT UNIQUE,
  customer_id BIGINT NOT NULL REFERENCES crm_customers (id) ON DELETE CASCADE,
  order_date TEXT NOT NULL DEFAULT '',
  product_name TEXT NOT NULL DEFAULT '',
  amount_vnd BIGINT NOT NULL DEFAULT 0,
  quantity INT NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'completed',
  reference_code TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  contract_id BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS crm_customer_issues (
  id BIGSERIAL PRIMARY KEY,
  sqlite_issue_id BIGINT UNIQUE,
  customer_id BIGINT NOT NULL REFERENCES crm_customers (id) ON DELETE CASCADE,
  case_id BIGINT,
  issue_type TEXT NOT NULL DEFAULT 'other',
  priority TEXT NOT NULL DEFAULT 'binh_thuong',
  status TEXT NOT NULL DEFAULT 'moi',
  title TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  resolution TEXT NOT NULL DEFAULT '',
  assigned_staff_id BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS crm_customer_brief_scans (
  id BIGSERIAL PRIMARY KEY,
  sqlite_brief_id BIGINT UNIQUE,
  customer_id BIGINT NOT NULL REFERENCES crm_customers (id) ON DELETE CASCADE,
  meeting_purpose TEXT NOT NULL DEFAULT '',
  ai_output TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE crm_cases
  ADD COLUMN IF NOT EXISTS deal_value_vnd BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS campaign_id BIGINT;

CREATE TABLE IF NOT EXISTS crm_case_events (
  id BIGSERIAL PRIMARY KEY,
  sqlite_event_id BIGINT UNIQUE,
  case_id BIGINT NOT NULL REFERENCES crm_cases (id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'ghi_chu',
  body TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS crm_care_reports (
  id BIGSERIAL PRIMARY KEY,
  sqlite_report_id BIGINT UNIQUE,
  case_id BIGINT NOT NULL REFERENCES crm_cases (id) ON DELETE CASCADE,
  staff_id BIGINT,
  staff_name TEXT NOT NULL DEFAULT '',
  contact_type TEXT NOT NULL DEFAULT '',
  care_status TEXT NOT NULL DEFAULT '',
  summary TEXT NOT NULL DEFAULT '',
  next_action TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS crm_tickets (
  id BIGSERIAL PRIMARY KEY,
  sqlite_ticket_id BIGINT UNIQUE,
  customer_id BIGINT NOT NULL REFERENCES crm_customers (id) ON DELETE CASCADE,
  ticket_type TEXT NOT NULL DEFAULT 'phan_anh',
  status TEXT NOT NULL DEFAULT 'moi',
  priority TEXT NOT NULL DEFAULT 'binh_thuong',
  channel TEXT NOT NULL DEFAULT 'khac',
  title TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  resolution TEXT NOT NULL DEFAULT '',
  assigned_staff_id BIGINT,
  sentiment_label TEXT NOT NULL DEFAULT '',
  sentiment_score INT,
  sentiment_confidence REAL,
  sentiment_scored_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_crm_tickets_status ON crm_tickets (status);
CREATE INDEX IF NOT EXISTS idx_crm_tickets_customer ON crm_tickets (customer_id);

CREATE TABLE IF NOT EXISTS crm_ticket_messages (
  id BIGSERIAL PRIMARY KEY,
  sqlite_message_id BIGINT UNIQUE,
  ticket_id BIGINT NOT NULL REFERENCES crm_tickets (id) ON DELETE CASCADE,
  author_staff_id BIGINT,
  body TEXT NOT NULL DEFAULT '',
  is_internal BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_ticket_messages_ticket ON crm_ticket_messages (ticket_id);

COMMIT;
