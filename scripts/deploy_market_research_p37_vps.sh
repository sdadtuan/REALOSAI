#!/usr/bin/env bash
# Deploy Market Research OS P37 — ISO 20252 gap-check read-only (RES-UC-099).
#
# Forward path: 1/3 DDL (P0–P36) → 2/3 api → 3/3 ops-web.
# P37 does NOT rebuild portal-web. No P37 DDL.
# Flags untouched (prod-safe).
#
# From laptop:
#   APPLY=1 ./scripts/deploy_market_research_p37_vps.sh
#
# On VPS:
#   cd /var/www/rnosai && git pull --ff-only origin main && bash scripts/deploy_market_research_p37_vps.sh --local
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
  echo "== Market Research P37 deploy @ $(git -C "$ROOT" rev-parse --short HEAD) =="
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

  echo "== 1/3 Apply Market Research P0–P7 + P10 + P11 + P13 + P20 + P21 + P23 + P36 DDL =="
  bash "$ROOT/scripts/apply_pg_ddl_market_research.sh"
  bash "$ROOT/scripts/apply_pg_ddl_market_research_p1.sh"
  bash "$ROOT/scripts/apply_pg_ddl_market_research_p2.sh"
  bash "$ROOT/scripts/apply_pg_ddl_market_research_p3.sh"
  bash "$ROOT/scripts/apply_pg_ddl_market_research_p4.sh"
  bash "$ROOT/scripts/apply_pg_ddl_market_research_p5.sh"
  bash "$ROOT/scripts/apply_pg_ddl_market_research_p6.sh"
  bash "$ROOT/scripts/apply_pg_ddl_market_research_p7.sh"
  bash "$ROOT/scripts/apply_pg_ddl_market_research_p10.sh"
  bash "$ROOT/scripts/apply_pg_ddl_market_research_p11.sh"
  bash "$ROOT/scripts/apply_pg_ddl_market_research_p13.sh"
  bash "$ROOT/scripts/apply_pg_ddl_market_research_p20.sh"
  bash "$ROOT/scripts/apply_pg_ddl_market_research_p21.sh"
  bash "$ROOT/scripts/apply_pg_ddl_market_research_p23.sh"
  bash "$ROOT/scripts/apply_pg_ddl_market_research_p36.sh"

  echo "== flags untouched (RAG + OpenAI embed + pgvector + Talkwalker stay off) =="

  echo "== 2/3 ptt-crm-api =="
  cd "$ROOT/services/ptt-crm-api"
  npm ci
  export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=2048}"
  npm run build
  npm test -- --testPathPattern='market-research|portal-research' --passWithNoTests --no-coverage
  sudo -n /usr/bin/systemctl restart ptt-crm-api 2>/dev/null || true
  sleep 3
  curl -sf http://127.0.0.1:3000/health -o /dev/null && echo " api OK" || echo "WARN  api health check failed"

  echo "== 3/3 ops-web =="
  cd "$ROOT"
  export_public_flag_from_runtime
  export NEXT_PUBLIC_PTT_API_URL="${NEXT_PUBLIC_PTT_API_URL:-https://rs.pttads.vn}"
  "$ROOT/scripts/deploy_ops_web.sh" build
  sudo -n /usr/bin/systemctl restart ptt-ops-web 2>/dev/null || true
  sleep 2
  curl -sf http://127.0.0.1:3200/login -o /dev/null && echo " ops-web OK" || echo "WARN  ops-web health check failed"

  echo "== Market Research P37 deploy complete =="
  echo "UAT: bash scripts/smoke_market_research_p37.sh"
}

if [[ "${1:-}" == "--local" ]]; then
  run_local
elif [[ "$APPLY" == "1" ]]; then
  ssh "${VPS_USER}@${VPS_HOST}" "cd ${VPS_ROOT} && git pull --ff-only origin main && bash scripts/deploy_market_research_p37_vps.sh --local"
else
  echo "Dry-run. Set APPLY=1 to deploy to ${VPS_USER}@${VPS_HOST}:${VPS_ROOT}"
  echo "Or on VPS: bash scripts/deploy_market_research_p37_vps.sh --local"
fi
