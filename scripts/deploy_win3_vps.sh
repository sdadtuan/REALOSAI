#!/usr/bin/env bash
# Deploy WIN-3-A (Permission Sets + crm_gdkd) on VPS: DDL R2-B + migration R2-A + Nest + ops-web.
#
# From laptop:
#   APPLY=1 ./scripts/deploy_win3_vps.sh
#
# On VPS directly:
#   cd /var/www/rnosai && git pull origin main && sudo bash scripts/deploy_win3_vps.sh --local
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VPS_HOST="${PTT_VPS_HOST:-rs.pttads.vn}"
VPS_USER="${PTT_VPS_USER:-deploy}"
VPS_ROOT="${PTT_VPS_ROOT:-/var/www/rnosai}"
APPLY="${APPLY:-0}"

run_local() {
  cd "$ROOT"
  echo "== WIN-3-A deploy @ $(git rev-parse --short HEAD) =="

  if [[ -f "$ROOT/.env" ]]; then
    set -a
    # shellcheck disable=SC1091
    source "$ROOT/.env"
    set +a
  fi
  export DATABASE_URL="${DATABASE_URL:-postgresql://ptt:ptt_dev@127.0.0.1:5433/rnosaidb}"

  echo "== backup =="
  if [[ -x "$ROOT/scripts/backup_ptt_data.sh" ]]; then
    "$ROOT/scripts/backup_ptt_data.sh" || true
  fi

  echo "== DDL R2-B permission sets =="
  "$ROOT/scripts/apply_pg_ddl_permission_sets_r2_b.sh"

  echo "== R2-A GDKD migration =="
  PYTHON="${PYTHON:-python3}"
  if [[ -x "$ROOT/.venv/bin/python" ]]; then
    PYTHON="$ROOT/.venv/bin/python"
  fi
  export PYTHONPATH="$ROOT${PYTHONPATH:+:$PYTHONPATH}"
  if "$PYTHON" "$ROOT/scripts/migrate_staff_permissions_pg.py" --r2-gdkd --apply 2>/dev/null; then
    echo "r2-gdkd via python OK"
  else
    echo "r2-gdkd via python skipped — applying SQL fallback"
    psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
INSERT INTO staff_section_permissions (position_id, section_id, action)
SELECT DISTINCT position_id, 'crm_gdkd', 'assign'
FROM staff_section_permissions
WHERE section_id = 'crm_leads' AND action = 'assign'
ON CONFLICT (position_id, section_id, action) DO NOTHING;

INSERT INTO staff_section_permissions (position_id, section_id, action)
SELECT p.id, 'crm_gdkd', act
FROM crm_positions p
CROSS JOIN (VALUES ('override'), ('assign'), ('review_queue'), ('view_all_leads')) AS t(act)
WHERE lower(trim(p.code)) = 'super-admin'
ON CONFLICT (position_id, section_id, action) DO NOTHING;
SQL
  fi

  echo "== Nest ptt-crm-api =="
  cd "$ROOT/services/ptt-crm-api"
  npm ci
  npm run build
  sudo -n /usr/bin/systemctl restart ptt-crm-api
  sleep 2
  curl -sf http://127.0.0.1:3000/health && echo " Nest OK"

  echo "== ops-web =="
  cd "$ROOT"
  export NEXT_PUBLIC_PTT_API_URL="${NEXT_PUBLIC_PTT_API_URL:-https://rs.pttads.vn}"
  export NEXT_PUBLIC_WIN_ORG_UI="${NEXT_PUBLIC_WIN_ORG_UI:-1}"
  export NEXT_PUBLIC_WIN_KPI_SOLUTION="${NEXT_PUBLIC_WIN_KPI_SOLUTION:-1}"
  export NEXT_PUBLIC_WIN_PERMISSION_SETS="${NEXT_PUBLIC_WIN_PERMISSION_SETS:-1}"
  "$ROOT/scripts/deploy_ops_web.sh" build
  sudo -n /usr/bin/systemctl restart ptt-ops-web
  sleep 2
  curl -sf http://127.0.0.1:3200/login -o /dev/null && echo " ops-web OK"

  echo ""
  echo "WIN-3-A deploy complete."
  echo "Verify: https://ops.pttads.vn/admin/crm/permission-sets"
}

if [[ "${1:-}" == "--local" ]]; then
  run_local
  exit 0
fi

echo "==> WIN-3-A VPS deploy → ${VPS_USER}@${VPS_HOST}:${VPS_ROOT} (APPLY=$APPLY)"
if [[ "$APPLY" != "1" ]]; then
  echo "Dry-run — set APPLY=1 to pull + deploy on VPS"
  exit 0
fi

ssh -o BatchMode=yes -o StrictHostKeyChecking=accept-new "${VPS_USER}@${VPS_HOST}" \
  "cd '$VPS_ROOT' && git pull --ff-only origin main && sudo bash scripts/deploy_win3_vps.sh --local"
