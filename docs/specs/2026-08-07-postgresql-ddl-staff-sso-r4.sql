-- R4 staff SSO (WIN-4-A) — oidc_sub, group map, auth audit, token revoke version

ALTER TABLE staff_users
  ADD COLUMN IF NOT EXISTS oidc_sub TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_staff_users_oidc_sub
  ON staff_users (oidc_sub)
  WHERE oidc_sub IS NOT NULL;

ALTER TABLE staff_users
  ADD COLUMN IF NOT EXISTS auth_token_version INT NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS staff_keycloak_group_map (
  kc_group TEXT PRIMARY KEY,
  position_id INT NOT NULL REFERENCES crm_positions(id),
  default_set_codes TEXT[] NOT NULL DEFAULT '{}',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by VARCHAR(255) NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS staff_auth_audit (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES staff_users(id) ON DELETE SET NULL,
  email VARCHAR(255) NOT NULL DEFAULT '',
  event_type VARCHAR(64) NOT NULL,
  detail_json JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_auth_audit_user_created
  ON staff_auth_audit (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_staff_auth_audit_event_created
  ON staff_auth_audit (event_type, created_at DESC);

-- Default group → position seeds (idempotent; position must exist)
INSERT INTO staff_keycloak_group_map (kc_group, position_id, default_set_codes, updated_by)
SELECT 'grp-super-admin', id, '{}', 'ddl-r4'
FROM crm_positions WHERE lower(trim(code)) = 'super-admin'
ON CONFLICT (kc_group) DO NOTHING;

INSERT INTO staff_keycloak_group_map (kc_group, position_id, default_set_codes, updated_by)
SELECT 'grp-am', sub.id, '{}', 'ddl-r4'
FROM (
  SELECT id FROM crm_positions WHERE lower(trim(code)) IN ('kd-01', 'am-01') ORDER BY id LIMIT 1
) sub
ON CONFLICT (kc_group) DO NOTHING;

INSERT INTO staff_keycloak_group_map (kc_group, position_id, default_set_codes, updated_by)
SELECT 'grp-mkt', sub.id, '{}', 'ddl-r4'
FROM (
  SELECT id FROM crm_positions WHERE lower(trim(code)) IN ('mkt-01', 'mkt-02') ORDER BY id LIMIT 1
) sub
ON CONFLICT (kc_group) DO NOTHING;
