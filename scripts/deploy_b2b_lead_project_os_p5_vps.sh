#!/usr/bin/env bash
# Deploy B2B Lead Project OS — Phase 5 (mobile inbox, hot alarm, sticky call CTA).
# P1–P4 must already be deployed. Flag PTT_B2B_PROJECT_OS stays OFF by default.
#
# From laptop:
#   APPLY=1 ./scripts/deploy_b2b_lead_project_os_p5_vps.sh
#
# On VPS:
#   cd /var/www/rnosai && git pull --ff-only origin main && bash scripts/deploy_b2b_lead_project_os_p5_vps.sh --local
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VPS_HOST="${PTT_VPS_HOST:-rs.pttads.vn}"
VPS_USER="${PTT_VPS_USER:-deploy}"
VPS_ROOT="${PTT_VPS_ROOT:-/var/www/rnosai}"
APPLY="${APPLY:-0}"

run_local() {
  echo "== B2B Lead Project OS P5 deploy @ $(git -C "$ROOT" rev-parse --short HEAD) =="
  cd "$ROOT"

  if [[ -f "$ROOT/.env" ]]; then
    set -a
    # shellcheck disable=SC1091
    source "$ROOT/.env"
    set +a
  fi

  echo "== 1/2 ops-web build + test =="
  cd "$ROOT"
  export NEXT_PUBLIC_PTT_API_URL="${NEXT_PUBLIC_PTT_API_URL:-https://rs.pttads.vn}"
  "$ROOT/scripts/deploy_ops_web.sh" build
  cd "$ROOT/services/ops-web"
  npx vitest run src/lib/b2b-hot-alarm.spec.ts

  echo "== 2/2 restart ops-web =="
  sudo -n /usr/bin/systemctl restart ptt-ops-web 2>/dev/null || true
  sleep 2
  curl -sf http://127.0.0.1:3200/login -o /dev/null && echo " ops-web OK" || echo "WARN  ops-web health check failed"

  echo "== B2B Lead Project OS P5 deploy complete =="
  echo "P5: /crm/b2b-inbox, B2bHotAlarm (15s poll, 880Hz ≤30s), mobile sticky Gọi on lead detail."
  echo "Toggle chuông: inbox checkbox or localStorage.b2bHotSound=0"
}

if [[ "${1:-}" == "--local" ]]; then
  run_local
elif [[ "$APPLY" == "1" ]]; then
  ssh "${VPS_USER}@${VPS_HOST}" "cd ${VPS_ROOT} && git pull --ff-only origin main && bash scripts/deploy_b2b_lead_project_os_p5_vps.sh --local"
else
  echo "Dry-run. Set APPLY=1 to deploy to ${VPS_USER}@${VPS_HOST}:${VPS_ROOT}"
  echo "Or on VPS: bash scripts/deploy_b2b_lead_project_os_p5_vps.sh --local"
fi
