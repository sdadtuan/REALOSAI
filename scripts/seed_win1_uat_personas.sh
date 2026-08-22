#!/usr/bin/env bash
# Seed WIN-1 UAT personas via psql (no psycopg2 required).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -f "$ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env"
  set +a
fi

export DATABASE_URL="${DATABASE_URL:-postgresql://ptt:ptt_dev@127.0.0.1:5433/rnosaidb}"
PASSWORD="${WIN1_UAT_PASSWORD:-${OPS_E2E_STAFF_PASSWORD:-${ADMIN_PASSWORD:-}}}"
APPLY="${1:-}"

if [[ -z "$PASSWORD" || ${#PASSWORD} -lt 8 ]]; then
  echo "Cần mật khẩu ≥8 ký tự: WIN1_UAT_PASSWORD / OPS_E2E_STAFF_PASSWORD / ADMIN_PASSWORD" >&2
  exit 1
fi

hash_password() {
  python3 - "$PASSWORD" <<'PY'
import base64, hashlib, secrets, sys
plain = sys.argv[1]
salt = secrets.token_bytes(16)
key = hashlib.scrypt(plain.encode(), salt=salt, n=16384, r=8, p=1, dklen=64)
print(f"scrypt:{base64.b64encode(salt).decode()}:{base64.b64encode(key).decode()}")
PY
}

if [[ "$APPLY" != "--apply" ]]; then
  echo "=== WIN-1 UAT personas (dry-run) ==="
  echo "  win1-content@pttads.vn → content (MKT-02)"
  echo "  win1-design@pttads.vn → design (MKT-02)"
  echo "  admin@pttads.vn password sync"
  echo "  (thêm --apply để ghi DB)"
  exit 0
fi

PWD_HASH="$(hash_password)"
ADMIN_HASH="$PWD_HASH"

echo "=== WIN-1 UAT personas — apply ==="

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<SQL
INSERT INTO crm_positions (code, name, active)
SELECT 'MKT-02', 'Nhân viên Marketing', TRUE
WHERE NOT EXISTS (
  SELECT 1 FROM crm_positions WHERE lower(trim(code)) = 'mkt-02'
);

INSERT INTO staff_users (email, password_hash, display_name, position_id, active)
VALUES (
  'admin@pttads.vn',
  '$ADMIN_HASH',
  'Quản trị hệ thống',
  (SELECT id FROM crm_positions WHERE code = 'SUPER-ADMIN' LIMIT 1),
  TRUE
)
ON CONFLICT (email) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  display_name = EXCLUDED.display_name,
  active = TRUE,
  updated_at = NOW();

INSERT INTO staff_users (email, password_hash, display_name, position_id, active)
VALUES (
  'win1-content@pttads.vn',
  '$PWD_HASH',
  'P1 Content UAT',
  (SELECT id FROM crm_positions WHERE code = 'MKT-02' LIMIT 1),
  TRUE
)
ON CONFLICT (email) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  display_name = EXCLUDED.display_name,
  position_id = EXCLUDED.position_id,
  active = TRUE,
  updated_at = NOW();

INSERT INTO staff_users (email, password_hash, display_name, position_id, active)
VALUES (
  'win1-design@pttads.vn',
  '$PWD_HASH',
  'P2 Design UAT',
  (SELECT id FROM crm_positions WHERE code = 'MKT-02' LIMIT 1),
  TRUE
)
ON CONFLICT (email) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  display_name = EXCLUDED.display_name,
  position_id = EXCLUDED.position_id,
  active = TRUE,
  updated_at = NOW();

DELETE FROM staff_user_job_functions
WHERE user_id IN (
  SELECT id FROM staff_users WHERE email IN ('win1-content@pttads.vn', 'win1-design@pttads.vn')
);

INSERT INTO staff_user_job_functions (user_id, function_code, assigned_by)
SELECT id, 'content', 'seed_win1_uat_personas'
FROM staff_users WHERE email = 'win1-content@pttads.vn';

INSERT INTO staff_user_job_functions (user_id, function_code, assigned_by)
SELECT id, 'design', 'seed_win1_uat_personas'
FROM staff_users WHERE email = 'win1-design@pttads.vn';
SQL

echo "OK personas:"
psql "$DATABASE_URL" -tAc "
SELECT u.email, p.code, COALESCE(string_agg(j.function_code, ', '), '')
FROM staff_users u
JOIN crm_positions p ON p.id = u.position_id
LEFT JOIN staff_user_job_functions j ON j.user_id = u.id
WHERE u.email IN ('admin@pttads.vn', 'win1-content@pttads.vn', 'win1-design@pttads.vn')
GROUP BY u.email, p.code
ORDER BY u.email;
"

echo ""
echo "Login UAT (shared password from ADMIN_PASSWORD / WIN1_UAT_PASSWORD):"
echo "  admin@pttads.vn"
echo "  win1-content@pttads.vn  (VUX-04 P1 content)"
echo "  win1-design@pttads.vn   (VUX-04 P2 design)"
