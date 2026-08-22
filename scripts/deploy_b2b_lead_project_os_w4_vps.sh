#!/usr/bin/env bash
# Deploy B2B Lead Project OS — Wave 4: explainable score, NBA, routing A/B.
# Requires W3 already deployed. PTT_B2B_PROJECT_OS stays OFF by default.
#
# From laptop:
#   APPLY=1 ./scripts/deploy_b2b_lead_project_os_w4_vps.sh
#
# On VPS:
#   cd /var/www/rnosai && git pull --ff-only origin main && bash scripts/deploy_b2b_lead_project_os_w4_vps.sh --local
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VPS_HOST="${PTT_VPS_HOST:-rs.pttads.vn}"
VPS_USER="${PTT_VPS_USER:-deploy}"
VPS_ROOT="${PTT_VPS_ROOT:-/var/www/rnosai}"
APPLY="${APPLY:-0}"

run_local() {
  echo "== B2B Lead Project OS W4 deploy @ $(git -C "$ROOT" rev-parse --short HEAD) =="
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

  echo "== 1/5 Apply B2B routing A/B DDL (W4) =="
  bash "$ROOT/scripts/apply_pg_ddl_b2b_routing_ab.sh"

  echo "== 2/5 ptt-crm-api build + b2b tests (W4) =="
  BUILD="$ROOT/.build-ptt-crm-api-w4"
  rm -rf "$BUILD"
  mkdir -p "$BUILD"
  rsync -a --exclude node_modules "$ROOT/services/ptt-crm-api/" "$BUILD/"
  cd "$BUILD"
  npm ci
  export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=6144}"
  npx nest build
  npm test -- --testPathPattern='b2b-nba|b2b-routing-ab|lead-score.engine' --no-coverage
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

  echo "== 5/5 W4 gate reminders =="
  echo "Lead detail: GET /api/v1/leads/:id/b2b-intelligence + block Vì sao Hot / NBA."
  echo "Routing feedback: crm_b2b_routing_ab row on first assign; won/lost on status patch."
  echo "GDKD report: GET /api/v1/b2b-routing-ab?days=30."

  echo "== B2B Lead Project OS W4 deploy complete =="
}

if [[ "${1:-}" == "--local" ]]; then
  run_local
elif [[ "$APPLY" == "1" ]]; then
  ssh "${VPS_USER}@${VPS_HOST}" "cd ${VPS_ROOT} && git pull --ff-only origin main && bash scripts/deploy_b2b_lead_project_os_w4_vps.sh --local"
else
  echo "Dry-run. Set APPLY=1 to deploy to ${VPS_USER}@${VPS_HOST}:${VPS_ROOT}"
  echo "Or on VPS: bash scripts/deploy_b2b_lead_project_os_w4_vps.sh --local"
fi
