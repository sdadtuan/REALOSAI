#!/usr/bin/env bash
# Deploy B2B Lead Project OS — Wave 5: Zalo inbox, PM role, ads CAPI, DNC.
# Requires W4 already deployed. PTT_B2B_ADS_CAPI stays OFF by default.
#
# From laptop:
#   APPLY=1 ./scripts/deploy_b2b_lead_project_os_w5_vps.sh
#
# On VPS:
#   cd /var/www/rnosai && git pull --ff-only origin main && bash scripts/deploy_b2b_lead_project_os_w5_vps.sh --local
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VPS_HOST="${PTT_VPS_HOST:-rs.pttads.vn}"
VPS_USER="${PTT_VPS_USER:-deploy}"
VPS_ROOT="${PTT_VPS_ROOT:-/var/www/rnosai}"
APPLY="${APPLY:-0}"

run_local() {
  echo "== B2B Lead Project OS W5 deploy @ $(git -C "$ROOT" rev-parse --short HEAD) =="
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

  echo "== 1/5 Apply B2B W5 DDL =="
  bash "$ROOT/scripts/apply_pg_ddl_b2b_w5.sh"

  echo "== 2/5 ptt-crm-api build + b2b tests (W5) =="
  BUILD="$ROOT/.build-ptt-crm-api-w5"
  rm -rf "$BUILD"
  mkdir -p "$BUILD"
  rsync -a --exclude node_modules "$ROOT/services/ptt-crm-api/" "$BUILD/"
  cd "$BUILD"
  npm ci
  export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=6144}"
  npx nest build
  npm test -- --testPathPattern='b2b-visibility|b2b-dnc|b2b-ads-capi|b2b-conversations|b2b-calls.service|b2b-sla.util' --no-coverage
  rsync -a dist/ "$ROOT/services/ptt-crm-api/dist/"
  rsync -a node_modules/ "$ROOT/services/ptt-crm-api/node_modules/"
  rm -rf "$BUILD"

  echo "== 3/5 ops-web build =="
  cd "$ROOT"
  export NEXT_PUBLIC_PTT_API_URL="${NEXT_PUBLIC_PTT_API_URL:-https://rs.pttads.vn}"
  "$ROOT/scripts/deploy_ops_web.sh" build

  echo "== 4/5 restart services =="
  sudo -n /usr/bin/systemctl restart ptt-crm-api 2>/dev/null || true
  sudo -n /usr/bin/systemctl restart ptt-ops-web 2>/dev/null || true
  sleep 5
  curl -sf http://127.0.0.1:3000/health -o /dev/null && echo " ptt-crm-api OK" || echo "WARN  ptt-crm-api health check failed"
  curl -sf http://127.0.0.1:3200/login -o /dev/null && echo " ops-web OK" || echo "WARN  ops-web health check failed"

  echo "== 5/5 W5 gate reminders =="
  echo "Zalo thread: GET /api/v1/leads/:id/b2b-conversation + /crm/b2b-inbox/thread/:leadId"
  echo "PM role: crm_b2b_project_staff.role=project_manager"
  echo "Ads CAPI: PTT_B2B_ADS_CAPI=1 + crm_b2b_ads_capi_log on won"
  echo "DNC: crm_b2b_dnc + consent checkbox before softphone"

  echo "== B2B Lead Project OS W5 deploy complete =="
}

if [[ "${1:-}" == "--local" ]]; then
  run_local
elif [[ "$APPLY" == "1" ]]; then
  ssh "${VPS_USER}@${VPS_HOST}" "cd ${VPS_ROOT} && git pull --ff-only origin main && bash scripts/deploy_b2b_lead_project_os_w5_vps.sh --local"
else
  echo "Dry-run. Set APPLY=1 to deploy to ${VPS_USER}@${VPS_HOST}:${VPS_ROOT}"
  echo "Or on VPS: bash scripts/deploy_b2b_lead_project_os_w5_vps.sh --local"
fi
