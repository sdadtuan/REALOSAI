#!/usr/bin/env bash
# Deploy B2B Lead Project OS — Phase 2 (ingress map, webhook slug, ops-web UI).
# P1 DDL/RBAC must already be applied. Flag PTT_B2B_PROJECT_OS stays OFF by default.
#
# From laptop:
#   APPLY=1 ./scripts/deploy_b2b_lead_project_os_p2_vps.sh
#
# On VPS:
#   cd /var/www/rnosai && git pull --ff-only origin main && bash scripts/deploy_b2b_lead_project_os_p2_vps.sh --local
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VPS_HOST="${PTT_VPS_HOST:-rs.pttads.vn}"
VPS_USER="${PTT_VPS_USER:-deploy}"
VPS_ROOT="${PTT_VPS_ROOT:-/var/www/rnosai}"
APPLY="${APPLY:-0}"

run_local() {
  echo "== B2B Lead Project OS P2 deploy @ $(git -C "$ROOT" rev-parse --short HEAD) =="
  cd "$ROOT"

  if [[ -f "$ROOT/.env" ]]; then
    set -a
    # shellcheck disable=SC1091
    source "$ROOT/.env"
    set +a
  fi

  echo "== 1/3 ptt-crm-api build + test =="
  cd "$ROOT/services/ptt-crm-api"
  npm ci
  export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=2048}"
  npm run build
  npm test -- --testPathPattern='src/b2b-projects|lead-dedup.repository.spec|lead-create-enrichment.service.spec' --no-coverage

  echo "== 2/3 ops-web build =="
  cd "$ROOT"
  export NEXT_PUBLIC_PTT_API_URL="${NEXT_PUBLIC_PTT_API_URL:-https://rs.pttads.vn}"
  "$ROOT/scripts/deploy_ops_web.sh" build
  cd "$ROOT/services/ops-web"
  npx vitest run src/lib/b2b-projects-api.spec.ts

  echo "== 3/3 restart services =="
  sudo -n /usr/bin/systemctl restart ptt-crm-api 2>/dev/null || true
  sleep 3
  curl -sf http://127.0.0.1:3000/health -o /dev/null && echo " api OK" || echo "WARN  api health check failed"

  sudo -n /usr/bin/systemctl restart ptt-ops-web 2>/dev/null || true
  sleep 2
  curl -sf http://127.0.0.1:3200/login -o /dev/null && echo " ops-web OK" || echo "WARN  ops-web health check failed"

  sudo -n /usr/bin/systemctl restart ptt-worker 2>/dev/null || true
  systemctl is-active ptt-worker >/dev/null 2>&1 && echo " worker OK" \
    || echo "WARN  ptt-worker restart failed or not on VPS"

  echo "== B2B Lead Project OS P2 deploy complete =="
  echo "Flag PTT_B2B_PROJECT_OS stays OFF unless set in deploy/runtime.env (prod-safe)."
  echo "Webhook slug routes: /api/v1/webhooks/{meta|zalo}/{project-code}"
  echo "UI: /crm/b2b-projects (cap crm_b2b_projects.view)"
}

if [[ "${1:-}" == "--local" ]]; then
  run_local
elif [[ "$APPLY" == "1" ]]; then
  ssh "${VPS_USER}@${VPS_HOST}" "cd ${VPS_ROOT} && git pull --ff-only origin main && bash scripts/deploy_b2b_lead_project_os_p2_vps.sh --local"
else
  echo "Dry-run. Set APPLY=1 to deploy to ${VPS_USER}@${VPS_HOST}:${VPS_ROOT}"
  echo "Or on VPS: bash scripts/deploy_b2b_lead_project_os_p2_vps.sh --local"
fi
