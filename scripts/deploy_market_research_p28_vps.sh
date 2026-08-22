#!/usr/bin/env bash
# Deploy Market Research OS P28 — pgvector ANN staging gate (flag ∧ ready).
#
# Forward path: verify pgvector → 1/2 DDL (P0–P23 incl. P20) → 2/2 api.
# P28 does NOT rebuild ops-web or portal-web (API only). No P28 DDL.
#
# Default: flags untouched (prod-safe).
# Staging UAT only: --enable-pgvector-staging sets RESEARCH_RAG_PGVECTOR_ENABLED=1
#   (does NOT set RAG / OpenAI embed — enable those separately after PO sign-off).
#
# One-time before staging ANN: bash scripts/install_pgvector_vps.sh (requires sudo)
#
# From laptop:
#   APPLY=1 ./scripts/deploy_market_research_p28_vps.sh
#   APPLY=1 ./scripts/deploy_market_research_p28_vps.sh --enable-pgvector-staging  # via REMOTE_ARGS on VPS
#
# On VPS:
#   cd /var/www/rnosai && git pull --ff-only origin main && bash scripts/deploy_market_research_p28_vps.sh --local
#   bash scripts/deploy_market_research_p28_vps.sh --local --enable-pgvector-staging
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VPS_HOST="${PTT_VPS_HOST:-rs.pttads.vn}"
VPS_USER="${PTT_VPS_USER:-deploy}"
VPS_ROOT="${PTT_VPS_ROOT:-/var/www/rnosai}"
APPLY="${APPLY:-0}"
ENABLE_PGVECTOR_STAGING=0

for arg in "$@"; do
  if [[ "$arg" == "--enable-pgvector-staging" ]]; then
    ENABLE_PGVECTOR_STAGING=1
  fi
done

patch_pgvector_staging_env() {
  local env_file="$1"
  [[ -f "$env_file" ]] || return 0
  [[ -w "$env_file" ]] || {
    echo "SKIP  $env_file (not writable)"
    return 0
  }
  local kv="RESEARCH_RAG_PGVECTOR_ENABLED=1"
  local key="${kv%%=*}"
  if grep -q "^${key}=" "$env_file" 2>/dev/null; then
    sed -i.bak "s|^${key}=.*|${kv}|" "$env_file"
  else
    echo "$kv" >> "$env_file"
  fi
}

run_local() {
  echo "== Market Research P28 deploy @ $(git -C "$ROOT" rev-parse --short HEAD) =="
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
    echo "WARN  pgvector not ready — ANN will fail-soft to JSONB until: bash scripts/install_pgvector_vps.sh"
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

  if [[ "$ENABLE_PGVECTOR_STAGING" == "1" ]]; then
    echo "== flags --enable-pgvector-staging (staging/UAT only; RAG + OpenAI embed untouched) =="
    mkdir -p "$ROOT/deploy"
    touch "$ROOT/deploy/runtime.env"
    patch_pgvector_staging_env "$ROOT/deploy/runtime.env"
    patch_pgvector_staging_env "$ROOT/.env"
  else
    echo "== flags untouched (RAG + OpenAI embed + pgvector stay off) =="
  fi

  echo "== 2/2 ptt-crm-api =="
  cd "$ROOT/services/ptt-crm-api"
  npm ci
  npm run build
  npm test -- --testPathPattern='market-research|portal-research' --passWithNoTests --no-coverage
  sudo -n /usr/bin/systemctl restart ptt-crm-api 2>/dev/null || true
  sleep 3
  curl -sf http://127.0.0.1:3000/health -o /dev/null && echo " api OK" || echo "WARN  api health check failed"

  echo "== Market Research P28 deploy complete =="
  echo "UAT: bash scripts/smoke_market_research_p28.sh"
}

REMOTE_ARGS="--local"
if [[ "$ENABLE_PGVECTOR_STAGING" == "1" ]]; then
  REMOTE_ARGS="--local --enable-pgvector-staging"
fi

if [[ "${1:-}" == "--local" ]]; then
  run_local
elif [[ "$APPLY" == "1" ]]; then
  ssh "${VPS_USER}@${VPS_HOST}" "cd ${VPS_ROOT} && git pull --ff-only origin main && bash scripts/deploy_market_research_p28_vps.sh ${REMOTE_ARGS}"
else
  echo "Dry-run. Set APPLY=1 to deploy to ${VPS_USER}@${VPS_HOST}:${VPS_ROOT}"
  echo "Staging pgvector: pass --enable-pgvector-staging to remote script after PO sign-off"
  echo "Or on VPS: bash scripts/deploy_market_research_p28_vps.sh --local"
fi
