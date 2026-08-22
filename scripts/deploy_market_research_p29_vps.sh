#!/usr/bin/env bash
# Deploy Market Research OS P29 — PDF stale footer (staff + portal export).
#
# Forward path: verify pgvector (warn) → 1/2 DDL (P0–P23) → 2/2 api.
# P29 does NOT rebuild ops-web or portal-web (API only). No P29 DDL.
# Flags untouched (prod-safe).
#
# From laptop:
#   APPLY=1 ./scripts/deploy_market_research_p29_vps.sh
#
# On VPS:
#   cd /var/www/rnosai && git pull --ff-only origin main && bash scripts/deploy_market_research_p29_vps.sh --local
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VPS_HOST="${PTT_VPS_HOST:-rs.pttads.vn}"
VPS_USER="${PTT_VPS_USER:-deploy}"
VPS_ROOT="${PTT_VPS_ROOT:-/var/www/rnosai}"
APPLY="${APPLY:-0}"

run_local() {
  echo "== Market Research P29 deploy @ $(git -C "$ROOT" rev-parse --short HEAD) =="
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

  echo "== verify pgvector (warn if missing) =="
  if bash "$ROOT/scripts/verify_pgvector_market_research.sh"; then
    echo " pgvector ready"
  else
    echo "WARN  pgvector not ready (optional for P29)"
  fi

  echo "== 1/2 Apply Market Research P0–P7 + P10 + P11 + P13 + P20 + P21 + P23 DDL =="
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

  echo "== flags untouched (RAG + OpenAI embed + pgvector stay off) =="

  echo "== 2/2 ptt-crm-api =="
  cd "$ROOT/services/ptt-crm-api"
  npm ci
  npm run build
  npm test -- --testPathPattern='market-research|portal-research' --passWithNoTests --no-coverage
  sudo -n /usr/bin/systemctl restart ptt-crm-api 2>/dev/null || true
  sleep 3
  curl -sf http://127.0.0.1:3000/health -o /dev/null && echo " api OK" || echo "WARN  api health check failed"

  echo "== Market Research P29 deploy complete =="
  echo "UAT: bash scripts/smoke_market_research_p29.sh"
}

if [[ "${1:-}" == "--local" ]]; then
  run_local
elif [[ "$APPLY" == "1" ]]; then
  ssh "${VPS_USER}@${VPS_HOST}" "cd ${VPS_ROOT} && git pull --ff-only origin main && bash scripts/deploy_market_research_p29_vps.sh --local"
else
  echo "Dry-run. Set APPLY=1 to deploy to ${VPS_USER}@${VPS_HOST}:${VPS_ROOT}"
  echo "Or on VPS: bash scripts/deploy_market_research_p29_vps.sh --local"
fi
