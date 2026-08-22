#!/usr/bin/env bash
# Deploy B2B Lead Project OS — Wave 1 (SSE alerts, staff push, call-resolve, unmatched, list columns).
# W0 + P1–P6 must already be deployed. Flag PTT_B2B_PROJECT_OS stays OFF by default.
# Do not set PTT_B2B_PROJECT_OS=1 on prod in this script. Staging flag-on is ops-only.
#
# From laptop:
#   APPLY=1 ./scripts/deploy_b2b_lead_project_os_w1_vps.sh
#
# On VPS:
#   cd /var/www/rnosai && git pull --ff-only origin main && bash scripts/deploy_b2b_lead_project_os_w1_vps.sh --local
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VPS_HOST="${PTT_VPS_HOST:-rs.pttads.vn}"
VPS_USER="${PTT_VPS_USER:-deploy}"
VPS_ROOT="${PTT_VPS_ROOT:-/var/www/rnosai}"
APPLY="${APPLY:-0}"

run_local() {
  echo "== B2B Lead Project OS W1 deploy @ $(git -C "$ROOT" rev-parse --short HEAD) =="
  cd "$ROOT"

  if [[ -f "$ROOT/.env" ]]; then
    set -a
    # shellcheck disable=SC1091
    source "$ROOT/.env"
    set +a
  fi
  if [[ -z "${DATABASE_URL:-}" ]]; then
    export DATABASE_URL="postgresql://ptt:ptt_dev@127.0.0.1:5433/rnosaidb"
  fi

  echo "== 1/4 Apply B2B staff push DDL =="
  bash "$ROOT/scripts/apply_pg_ddl_b2b_staff_push.sh"

  echo "== 2/4 ptt-crm-api build + b2b tests =="
  cd "$ROOT/services/ptt-crm-api"
  npm ci
  export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=4096}"
  npm run build
  npm test -- --testPathPattern='b2b-projects|lead-v1.mapper' --no-coverage

  echo "== 3/4 ops-web build =="
  cd "$ROOT"
  export NEXT_PUBLIC_PTT_API_URL="${NEXT_PUBLIC_PTT_API_URL:-https://rs.pttads.vn}"
  "$ROOT/scripts/deploy_ops_web.sh" build

  echo "== 4/4 restart services =="
  sudo -n /usr/bin/systemctl restart ptt-crm-api 2>/dev/null || true
  sudo -n /usr/bin/systemctl restart ptt-ops-web 2>/dev/null || true
  sleep 5
  curl -sf http://127.0.0.1:3000/health -o /dev/null && echo " ptt-crm-api OK" || echo "WARN  ptt-crm-api health check failed"
  curl -sf http://127.0.0.1:3200/login -o /dev/null && echo " ops-web OK" || echo "WARN  ops-web health check failed"

  echo "== B2B Lead Project OS W1 deploy complete =="
  echo "W1: SSE stream (PTT_B2B_SSE), staff push hook (PTT_B2B_PUSH=0 default), unmatched workbench, B2B list columns."
  echo "Flags stay OFF on prod unless ops enables staging UAT first."
}

if [[ "${1:-}" == "--local" ]]; then
  run_local
elif [[ "$APPLY" == "1" ]]; then
  ssh "${VPS_USER}@${VPS_HOST}" "cd ${VPS_ROOT} && git pull --ff-only origin main && bash scripts/deploy_b2b_lead_project_os_w1_vps.sh --local"
else
  echo "Dry-run. Set APPLY=1 to deploy to ${VPS_USER}@${VPS_HOST}:${VPS_ROOT}"
  echo "Or on VPS: bash scripts/deploy_b2b_lead_project_os_w1_vps.sh --local"
fi
