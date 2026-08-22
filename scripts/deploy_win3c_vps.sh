#!/usr/bin/env bash
# Deploy WIN-3-C (R3 client scope pilot + UAT artifacts) on VPS.
#
# From laptop:
#   APPLY=1 ./scripts/deploy_win3c_vps.sh
#
# On VPS directly:
#   cd /var/www/rnosai && git pull origin main && bash scripts/deploy_win3c_vps.sh --local
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VPS_HOST="${PTT_VPS_HOST:-rs.pttads.vn}"
VPS_USER="${PTT_VPS_USER:-deploy}"
VPS_ROOT="${PTT_VPS_ROOT:-/var/www/rnosai}"
APPLY="${APPLY:-0}"

run_local() {
  cd "$ROOT"
  echo "== WIN-3-C deploy @ $(git rev-parse --short HEAD) =="

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

  echo "== DDL R3-A staff_user_clients =="
  bash "$ROOT/scripts/apply_pg_ddl_staff_user_clients_r3_a.sh"

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
  export NEXT_PUBLIC_WIN_SIMULATOR="${NEXT_PUBLIC_WIN_SIMULATOR:-1}"
  export NEXT_PUBLIC_WIN_BREAK_GLASS="${NEXT_PUBLIC_WIN_BREAK_GLASS:-1}"
  export NEXT_PUBLIC_WIN_SCOPE_PILOT="${NEXT_PUBLIC_WIN_SCOPE_PILOT:-1}"
  export STAFF_SCOPE_PILOT="${STAFF_SCOPE_PILOT:-1}"
  "$ROOT/scripts/deploy_ops_web.sh" build
  sudo -n /usr/bin/systemctl restart ptt-ops-web
  sleep 2
  curl -sf http://127.0.0.1:3200/login -o /dev/null && echo " ops-web OK"

  echo "== WIN-3-C deploy complete =="
  echo "Flags: STAFF_SCOPE_PILOT=1 NEXT_PUBLIC_WIN_SCOPE_PILOT=1"
}

if [[ "${1:-}" == "--local" ]]; then
  run_local
elif [[ "$APPLY" == "1" ]]; then
  ssh "${VPS_USER}@${VPS_HOST}" "cd ${VPS_ROOT} && git pull --ff-only origin main && bash scripts/deploy_win3c_vps.sh --local"
else
  echo "Dry-run. Set APPLY=1 to deploy to ${VPS_USER}@${VPS_HOST}:${VPS_ROOT}"
  echo "Or on VPS: bash scripts/deploy_win3c_vps.sh --local"
fi
