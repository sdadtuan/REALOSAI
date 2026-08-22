-- R3-A staff_user_clients (WIN-3-C client scope pilot)
-- Idempotent DDL for AM client workspace binding.

CREATE TABLE IF NOT EXISTS staff_user_clients (
  user_id UUID NOT NULL REFERENCES staff_users(id) ON DELETE CASCADE,
  client_id UUID NOT NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  granted_by VARCHAR(255) NOT NULL DEFAULT '',
  PRIMARY KEY (user_id, client_id)
);

CREATE INDEX IF NOT EXISTS idx_staff_user_clients_client
  ON staff_user_clients (client_id);
