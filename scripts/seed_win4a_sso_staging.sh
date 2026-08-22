#!/usr/bin/env bash
# Seed WIN-4-A staging personas + complete group→position map on PG.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
if [[ -f "$ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env"
  set +a
fi
export DATABASE_URL="${DATABASE_URL:-postgresql://ptt:ptt_dev@127.0.0.1:5433/rnosaidb}"

echo "== WIN-4-A SSO staging seed =="

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
-- GDKD position for MFA gate (if missing)
INSERT INTO crm_positions (code, name, active)
SELECT 'GDKD', 'Giám đốc kinh doanh', TRUE
WHERE NOT EXISTS (SELECT 1 FROM crm_positions WHERE lower(trim(code)) = 'gdkd');

INSERT INTO staff_keycloak_group_map (kc_group, position_id, default_set_codes, updated_by)
SELECT 'grp-gdkd', id, '{}', 'win4a-staging'
FROM crm_positions WHERE lower(trim(code)) = 'gdkd'
ON CONFLICT (kc_group) DO UPDATE SET position_id = EXCLUDED.position_id, updated_at = NOW();

INSERT INTO staff_keycloak_group_map (kc_group, position_id, default_set_codes, updated_by)
SELECT 'grp-cskh', id, '{}', 'win4a-staging'
FROM crm_positions WHERE lower(trim(code)) = 'cskh-01'
ON CONFLICT (kc_group) DO UPDATE SET position_id = EXCLUDED.position_id, updated_at = NOW();

INSERT INTO staff_keycloak_group_map (kc_group, position_id, default_set_codes, updated_by)
SELECT 'grp-it-admin', id, '{}', 'win4a-staging'
FROM crm_positions WHERE lower(trim(code)) = 'super-admin'
ON CONFLICT (kc_group) DO UPDATE SET position_id = EXCLUDED.position_id, updated_at = NOW();

INSERT INTO staff_keycloak_group_map (kc_group, position_id, default_set_codes, updated_by)
SELECT 'grp-hr-ops', id, '{}', 'win4a-staging'
FROM crm_positions WHERE lower(trim(code)) = 'super-admin'
ON CONFLICT (kc_group) DO UPDATE SET position_id = EXCLUDED.position_id, updated_at = NOW();

-- SSO demo users (password optional — login via Keycloak)
INSERT INTO staff_users (email, password_hash, display_name, position_id, active)
SELECT
  'gdkd-demo@pttads.vn',
  '',
  'GDKD Demo SSO',
  (SELECT id FROM crm_positions WHERE lower(trim(code)) = 'gdkd' LIMIT 1),
  TRUE
WHERE NOT EXISTS (SELECT 1 FROM staff_users WHERE lower(email) = 'gdkd-demo@pttads.vn');

INSERT INTO staff_users (email, password_hash, display_name, position_id, active)
SELECT
  'am-demo@pttads.vn',
  '',
  'AM Demo SSO',
  (SELECT id FROM crm_positions WHERE lower(trim(code)) = 'kd-01' LIMIT 1),
  TRUE
WHERE NOT EXISTS (SELECT 1 FROM staff_users WHERE lower(email) = 'am-demo@pttads.vn');

UPDATE staff_users SET position_id = (SELECT id FROM crm_positions WHERE lower(trim(code)) = 'gdkd' LIMIT 1)
WHERE lower(email) = 'gdkd-demo@pttads.vn';

UPDATE staff_users SET position_id = (SELECT id FROM crm_positions WHERE lower(trim(code)) = 'kd-01' LIMIT 1)
WHERE lower(email) = 'am-demo@pttads.vn';
SQL

echo "OK  group map + demo users"
psql "$DATABASE_URL" -c "SELECT kc_group, position_id FROM staff_keycloak_group_map ORDER BY 1;"
psql "$DATABASE_URL" -c "SELECT email, position_id FROM staff_users WHERE email LIKE '%-demo@pttads.vn';"
