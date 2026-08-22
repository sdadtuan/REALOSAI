#!/usr/bin/env bash
# Deploy B2B Lead Project OS — Phase 6 (visibility C on intake, review queue, AI list, export).
# P1–P5 must already be deployed. Flag PTT_B2B_PROJECT_OS stays OFF by default.
#
# From laptop:
#   APPLY=1 ./scripts/deploy_b2b_lead_project_os_p6_vps.sh
#
# On VPS:
#   cd /var/www/rnosai && git pull --ff-only origin main && bash scripts/deploy_b2b_lead_project_os_p6_vps.sh --local
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VPS_HOST="${PTT_VPS_HOST:-rs.pttads.vn}"
VPS_USER="${PTT_VPS_USER:-deploy}"
VPS_ROOT="${PTT_VPS_ROOT:-/var/www/rnosai}"
APPLY="${APPLY:-0}"

run_local() {
  echo "== B2B Lead Project OS P6 deploy @ $(git -C "$ROOT" rev-parse --short HEAD) =="
  cd "$ROOT"

  if [[ -f "$ROOT/.env" ]]; then
    set -a
    # shellcheck disable=SC1091
    source "$ROOT/.env"
    set +a
  fi

  echo "== 1/2 ptt-crm-api build + b2b tests =="
  cd "$ROOT/services/ptt-crm-api"
  npm ci
  export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=2048}"
  npm run build
  npm test -- --testPathPattern='b2b-projects|lead-flow-list-filter.util' --no-coverage

  echo "== 2/2 restart ptt-crm-api =="
  sudo -n /usr/bin/systemctl restart ptt-crm-api 2>/dev/null || true
  sleep 2
  curl -sf http://127.0.0.1:3000/health -o /dev/null && echo " ptt-crm-api OK" || echo "WARN  ptt-crm-api health check failed"

  echo "== B2B Lead Project OS P6 deploy complete =="
  echo "P6: visibility C on intake, review-queue SQL scope, AI list_leads/get_lead filter, export scope."
  echo "Smoke (flag ON + STAFF_TOKEN): bash scripts/smoke_b2b_project_os.sh"
}

if [[ "${1:-}" == "--local" ]]; then
  run_local
elif [[ "$APPLY" == "1" ]]; then
  ssh "${VPS_USER}@${VPS_HOST}" "cd ${VPS_ROOT} && git pull --ff-only origin main && bash scripts/deploy_b2b_lead_project_os_p6_vps.sh --local"
else
  echo "Dry-run. Set APPLY=1 to deploy to ${VPS_USER}@${VPS_HOST}:${VPS_ROOT}"
  echo "Or on VPS: bash scripts/deploy_b2b_lead_project_os_p6_vps.sh --local"
fi
