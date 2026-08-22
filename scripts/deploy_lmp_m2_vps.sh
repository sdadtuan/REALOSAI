#!/usr/bin/env bash
# Deploy M2 qualify/handoff bundle — ops-web only.
#
# From laptop:
#   APPLY=1 ./scripts/deploy_lmp_m2_vps.sh
#
# On VPS:
#   cd /var/www/rnosai && git pull origin main && bash scripts/deploy_lmp_m2_vps.sh --local
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VPS_HOST="${PTT_VPS_HOST:-rs.pttads.vn}"
VPS_USER="${PTT_VPS_USER:-deploy}"
VPS_ROOT="${PTT_VPS_ROOT:-/var/www/rnosai}"
APPLY="${APPLY:-0}"

run_local() {
  echo "== M2 qualify/handoff deploy @ $(git -C "$ROOT" rev-parse --short HEAD) =="
  cd "$ROOT"
  export NEXT_PUBLIC_PTT_API_URL="${NEXT_PUBLIC_PTT_API_URL:-https://rs.pttads.vn}"
  export NEXT_PUBLIC_LEAD_MEETING_PREP="${NEXT_PUBLIC_LEAD_MEETING_PREP:-1}"
  export NEXT_PUBLIC_PWA_ENABLED="${NEXT_PUBLIC_PWA_ENABLED:-1}"

  echo "== ops-web build (M2QualifyHandoffCard + BANT checklist) =="
  "$ROOT/scripts/deploy_ops_web.sh" build
  sudo -n /usr/bin/systemctl restart ptt-ops-web 2>/dev/null || true
  sleep 2
  curl -sf http://127.0.0.1:3200/login -o /dev/null && echo " ops-web OK" || echo "WARN  ops-web health check failed"

  echo "== M2 deploy complete =="
  echo "UAT: B2 done → thẻ M2 funnel · Intake sidebar BANT · Consult brief SCI · Copilot prep 15p"
}

if [[ "${1:-}" == "--local" ]]; then
  run_local
elif [[ "$APPLY" == "1" ]]; then
  ssh "${VPS_USER}@${VPS_HOST}" "cd ${VPS_ROOT} && git pull --ff-only origin main && bash scripts/deploy_lmp_m2_vps.sh --local"
else
  echo "Dry-run. Set APPLY=1 to deploy to ${VPS_USER}@${VPS_HOST}:${VPS_ROOT}"
fi
