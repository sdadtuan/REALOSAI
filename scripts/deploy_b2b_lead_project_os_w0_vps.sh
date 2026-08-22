#!/usr/bin/env bash
# Deploy B2B Lead Project OS — Wave 0 (active staff visibility + UAT/smoke).
# P1–P6 must already be deployed. Flag PTT_B2B_PROJECT_OS stays OFF by default.
# Do not set PTT_B2B_PROJECT_OS=1 on prod in this script. Staging flag-on is ops-only.
#
# From laptop:
#   APPLY=1 ./scripts/deploy_b2b_lead_project_os_w0_vps.sh
#
# On VPS:
#   cd /var/www/rnosai && git pull --ff-only origin main && bash scripts/deploy_b2b_lead_project_os_w0_vps.sh --local
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VPS_HOST="${PTT_VPS_HOST:-rs.pttads.vn}"
VPS_USER="${PTT_VPS_USER:-deploy}"
VPS_ROOT="${PTT_VPS_ROOT:-/var/www/rnosai}"
APPLY="${APPLY:-0}"

run_local() {
  echo "== B2B Lead Project OS W0 deploy @ $(git -C "$ROOT" rev-parse --short HEAD) =="
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
  sleep 5
  curl -sf http://127.0.0.1:3000/health -o /dev/null && echo " ptt-crm-api OK" || echo "WARN  ptt-crm-api health check failed"

  echo "== B2B Lead Project OS W0 deploy complete =="
  echo "W0: isActivePttStaff from crm_staff.active; UAT/smoke scripts; flag stays OFF."
  echo "Staging UAT (do not run on prod without tokens):"
  echo "  STAFF_TOKEN=... OUTSIDER_TOKEN=... DENIED_LEAD_ID=... OWNED_LEAD_ID=... bash scripts/uat_b2b_project_os.sh"
}

if [[ "${1:-}" == "--local" ]]; then
  run_local
elif [[ "$APPLY" == "1" ]]; then
  ssh "${VPS_USER}@${VPS_HOST}" "cd ${VPS_ROOT} && git pull --ff-only origin main && bash scripts/deploy_b2b_lead_project_os_w0_vps.sh --local"
else
  echo "Dry-run. Set APPLY=1 to deploy to ${VPS_USER}@${VPS_HOST}:${VPS_ROOT}"
  echo "Or on VPS: bash scripts/deploy_b2b_lead_project_os_w0_vps.sh --local"
fi
