#!/usr/bin/env bash
# Deploy Market Research OS P44 — staff reports API has_stale_insights (RES-UC-106).
#
# Forward path: 1/2 api → 2/2 ops-web.
# No DDL. Flags untouched (prod-safe).
#
# From laptop:
#   APPLY=1 ./scripts/deploy_market_research_p44_vps.sh
#
# On VPS:
#   cd /var/www/rnosai && git pull --ff-only origin main && bash scripts/deploy_market_research_p44_vps.sh --local
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VPS_HOST="${PTT_VPS_HOST:-rs.pttads.vn}"
VPS_USER="${PTT_VPS_USER:-deploy}"
VPS_ROOT="${PTT_VPS_ROOT:-/var/www/rnosai}"
APPLY="${APPLY:-0}"

export_public_flag_from_runtime() {
  local env_file="$ROOT/deploy/runtime.env"
  [[ -f "$env_file" ]] || return 0
  local line
  line="$(grep -E '^NEXT_PUBLIC_MARKET_RESEARCH=' "$env_file" | tail -1 || true)"
  if [[ -n "$line" ]]; then
    export NEXT_PUBLIC_MARKET_RESEARCH="${line#NEXT_PUBLIC_MARKET_RESEARCH=}"
    echo " NEXT_PUBLIC_MARKET_RESEARCH=${NEXT_PUBLIC_MARKET_RESEARCH} (from runtime.env; not flipped)"
  fi
}

run_local() {
  echo "== Market Research P44 deploy @ $(git -C "$ROOT" rev-parse --short HEAD) =="
  cd "$ROOT"

  echo "== flags untouched (RAG + OpenAI embed + pgvector stay off) =="

  echo "== 1/2 ptt-crm-api =="
  cd "$ROOT/services/ptt-crm-api"
  npm ci
  export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=2048}"
  npm run build
  npm test -- --testPathPattern='market-research|portal-research' --passWithNoTests --no-coverage
  sudo -n /usr/bin/systemctl restart ptt-crm-api 2>/dev/null || true
  sleep 3
  curl -sf http://127.0.0.1:3000/health -o /dev/null && echo " api OK" || echo "WARN  api health check failed"

  echo "== 2/2 ops-web =="
  cd "$ROOT"
  export_public_flag_from_runtime
  export NEXT_PUBLIC_PTT_API_URL="${NEXT_PUBLIC_PTT_API_URL:-https://rs.pttads.vn}"
  "$ROOT/scripts/deploy_ops_web.sh" build
  sudo -n /usr/bin/systemctl restart ptt-ops-web 2>/dev/null || true
  sleep 2
  curl -sf http://127.0.0.1:3200/login -o /dev/null && echo " ops-web OK" || echo "WARN  ops-web health check failed"

  echo "== Market Research P44 deploy complete =="
  echo "UAT: bash scripts/smoke_market_research_p44.sh"
}

if [[ "${1:-}" == "--local" ]]; then
  run_local
elif [[ "$APPLY" == "1" ]]; then
  ssh "${VPS_USER}@${VPS_HOST}" "cd ${VPS_ROOT} && git pull --ff-only origin main && bash scripts/deploy_market_research_p44_vps.sh --local"
else
  echo "Dry-run. Set APPLY=1 to deploy to ${VPS_USER}@${VPS_HOST}:${VPS_ROOT}"
  echo "Or on VPS: bash scripts/deploy_market_research_p44_vps.sh --local"
fi
