#!/usr/bin/env bash
# MKT-AI prod pilot deploy — 1 client lifecycle (P4-01-T7)
#
# From laptop:
#   export MKT_AI_PILOT_LIFECYCLE_ID=42
#   APPLY=1 ./scripts/deploy_mkt_ai_planner_prod_pilot.sh
#
# On VPS directly:
#   export MKT_AI_PILOT_LIFECYCLE_ID=42
#   cd /var/www/rnosai && bash scripts/deploy_mkt_ai_planner_prod_pilot.sh --local
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MKT_AI_PILOT_SLUG="${MKT_AI_PILOT_SERVICE_SLUG:-meta-lead-gen}"
VPS_HOST="${PTT_VPS_HOST:-rs.pttads.vn}"
VPS_USER="${PTT_VPS_USER:-deploy}"
VPS_ROOT="${PTT_VPS_ROOT:-/var/www/rnosai}"
APPLY="${APPLY:-0}"

run_local() {
  cd "$ROOT"
  : "${MKT_AI_PILOT_LIFECYCLE_ID:?Set MKT_AI_PILOT_LIFECYCLE_ID to real client lifecycle}"

  echo "== MKT-AI prod pilot deploy @ $(git rev-parse --short HEAD 2>/dev/null || echo unknown) =="
  echo "Pilot lifecycle #${MKT_AI_PILOT_LIFECYCLE_ID} slug=${MKT_AI_PILOT_SLUG}"

  if [[ -f "$ROOT/.env" ]]; then
    set -a
    # shellcheck disable=SC1091
    source "$ROOT/.env"
    set +a
  fi

  echo "== 1/6 Apply DDL =="
  bash "$ROOT/scripts/apply_pg_ddl_mkt_ai_planner.sh"
  bash "$ROOT/scripts/verify_mkt_ai_ddl.sh"

  echo "== 2/6 Prod pilot flags (single slug) =="
  RUNTIME_ENV="$ROOT/deploy/runtime.env"
  mkdir -p "$ROOT/deploy"
  touch "$RUNTIME_ENV"
  for kv in \
    "MKT_AI_PILOT_LIFECYCLE_ID=${MKT_AI_PILOT_LIFECYCLE_ID}" \
    "MKT_AI_PILOT_SERVICE_SLUG=${MKT_AI_PILOT_SLUG}" \
    "MKT_AI_PILOT_CLIENT_NAME=${MKT_AI_PILOT_CLIENT_NAME:-Client Pilot}" \
    "MKT_AI_PILOT_SOAK_DAYS=${MKT_AI_PILOT_SOAK_DAYS:-7}" \
    "PTT_MKT_AI_PLANNER_ENABLED=1" \
    "PTT_MKT_AI_PLANNER_SLUGS=${MKT_AI_PILOT_SLUG}" \
    "PTT_MKT_AI_RAG_ENABLED=1" \
    "PTT_MKT_AI_APPROVAL_REQUIRED=1" \
    "PTT_MKT_AI_KPI_ALERT_ENABLED=1" \
    "PTT_MKT_AI_PLAYBOOKS_ENABLED=1" \
    "PTT_MKT_AI_GOVERNANCE_BANNER=1" \
    "PTT_MKT_AI_MULTI_AGENT_ENABLED=1" \
    "PTT_MKT_AI_LAUNCH_QA_QUALITY_GATE=${PTT_MKT_AI_LAUNCH_QA_QUALITY_GATE:-0}" \
    "NEXT_PUBLIC_MKT_AI_PLANNER=1"; do
    key="${kv%%=*}"
    if grep -q "^${key}=" "$RUNTIME_ENV" 2>/dev/null; then
      sed -i.bak "s|^${key}=.*|${kv}|" "$RUNTIME_ENV"
    else
      echo "$kv" >>"$RUNTIME_ENV"
    fi
  done
  echo "Updated $RUNTIME_ENV"

  echo "== 3/6 Build + restart Nest API =="
  cd "$ROOT/services/ptt-crm-api"
  npm run build
  if sudo -n /usr/bin/systemctl restart ptt-crm-api 2>/dev/null; then
    sleep 3
    curl -sf http://127.0.0.1:3000/health && echo " Nest OK"
  else
    echo "WARN: sudo systemctl restart ptt-crm-api manually"
  fi
  cd "$ROOT"

  echo "== 4/6 Rebuild ops-web (NEXT_PUBLIC_MKT_AI_PLANNER=1) =="
  if sudo -n "$ROOT/scripts/deploy_ops_web.sh" 2>/dev/null; then
    echo "OK  ops-web build"
    sudo -n "$ROOT/scripts/deploy_ops_web.sh" --restart 2>/dev/null || echo "WARN ops-web restart manual"
  else
    echo "WARN: sudo ./scripts/deploy_ops_web.sh manually"
  fi

  echo "== 5/6 Prod pilot gate =="
  export PTT_API_URL="${PTT_API_URL:-http://127.0.0.1:3000}"
  bash "$ROOT/scripts/mkt_ai_prod_pilot_gate.sh"

  echo "== 6/6 Soak reminder =="
  echo "Monitor daily: bash scripts/mkt_ai_prod_pilot_monitor.sh"
  echo "Day ${MKT_AI_PILOT_SOAK_DAYS:-7} sign-off: deploy/mkt-ai-prod-pilot-signoff.template.json"
  echo ""
  echo "Rollback: bash scripts/mkt_ai_prod_pilot_rollback.sh"
  echo "== MKT-AI prod pilot deploy complete =="
}

if [[ "${1:-}" == "--local" ]]; then
  run_local
elif [[ "$APPLY" == "1" ]]; then
  echo "== SSH ${VPS_USER}@${VPS_HOST}:${VPS_ROOT} =="
  ssh "${VPS_USER}@${VPS_HOST}" \
    "cd ${VPS_ROOT} && git pull --ff-only origin main && \
     export MKT_AI_PILOT_LIFECYCLE_ID=${MKT_AI_PILOT_LIFECYCLE_ID} \
     MKT_AI_PILOT_SERVICE_SLUG=${MKT_AI_PILOT_SLUG} \
     MKT_AI_PILOT_CLIENT_NAME='${MKT_AI_PILOT_CLIENT_NAME:-Client Pilot}' && \
     bash scripts/deploy_mkt_ai_planner_prod_pilot.sh --local"
else
  echo "Dry-run. Required: MKT_AI_PILOT_LIFECYCLE_ID=<real lifecycle>"
  echo "  APPLY=1 MKT_AI_PILOT_LIFECYCLE_ID=42 ./scripts/deploy_mkt_ai_planner_prod_pilot.sh"
  echo "Or on VPS: bash scripts/deploy_mkt_ai_planner_prod_pilot.sh --local"
fi
