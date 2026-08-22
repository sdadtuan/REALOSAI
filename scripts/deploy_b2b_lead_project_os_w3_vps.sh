#!/usr/bin/env bash
# Deploy B2B Lead Project OS — Wave 3: manual split, commission ledger, GDKD ops center.
# Requires W12 already deployed. PTT_B2B_PROJECT_OS stays OFF by default.
#
# From laptop:
#   APPLY=1 ./scripts/deploy_b2b_lead_project_os_w3_vps.sh
#
# On VPS:
#   cd /var/www/rnosai && git pull --ff-only origin main && bash scripts/deploy_b2b_lead_project_os_w3_vps.sh --local
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VPS_HOST="${PTT_VPS_HOST:-rs.pttads.vn}"
VPS_USER="${PTT_VPS_USER:-deploy}"
VPS_ROOT="${PTT_VPS_ROOT:-/var/www/rnosai}"
APPLY="${APPLY:-0}"

run_local() {
  echo "== B2B Lead Project OS W3 deploy @ $(git -C "$ROOT" rev-parse --short HEAD) =="
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

  echo "== 1/6 Apply B2B commission ledger DDL (W3) =="
  bash "$ROOT/scripts/apply_pg_ddl_b2b_commission_ledger.sh"

  echo "== 2/6 ptt-crm-api build + b2b tests (W3) =="
  cd "$ROOT/services/ptt-crm-api"
  npm ci
  export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=6144}"
  npm run build
  npm test -- --testPathPattern='b2b-manual-reassign|b2b-commission-ledger|b2b-projects' --no-coverage

  echo "== 3/6 ops-web unit tests =="
  cd "$ROOT/services/ops-web"
  npm ci
  npm run test:unit -- src/lib/lead-contact-call.util.spec.ts

  echo "== 4/6 ops-web build =="
  cd "$ROOT"
  export NEXT_PUBLIC_PTT_API_URL="${NEXT_PUBLIC_PTT_API_URL:-https://rs.pttads.vn}"
  "$ROOT/scripts/deploy_ops_web.sh" build

  echo "== 5/6 restart services =="
  sudo -n /usr/bin/systemctl restart ptt-crm-api 2>/dev/null || true
  sudo -n /usr/bin/systemctl restart ptt-ops-web 2>/dev/null || true
  sleep 5
  curl -sf http://127.0.0.1:3000/health -o /dev/null && echo " ptt-crm-api OK" || echo "WARN  ptt-crm-api health check failed"
  curl -sf http://127.0.0.1:3200/login -o /dev/null && echo " ops-web OK" || echo "WARN  ops-web health check failed"

  echo "== 6/6 W3 gate reminders =="
  echo "Manual reassign: PATCH lead owner + split when PTT_B2B_PROJECT_OS=1."
  echo "Commission ledger: posts on contract approve/Active when split exists."
  echo "GDKD: GET /api/v1/b2b-ops-summary + /crm/b2b-gdkd."

  echo "== B2B Lead Project OS W3 deploy complete =="
}

if [[ "${1:-}" == "--local" ]]; then
  run_local
elif [[ "$APPLY" == "1" ]]; then
  ssh "${VPS_USER}@${VPS_HOST}" "cd ${VPS_ROOT} && git pull --ff-only origin main && bash scripts/deploy_b2b_lead_project_os_w3_vps.sh --local"
else
  echo "Dry-run. Set APPLY=1 to deploy to ${VPS_USER}@${VPS_HOST}:${VPS_ROOT}"
  echo "Or on VPS: bash scripts/deploy_b2b_lead_project_os_w3_vps.sh --local"
fi
