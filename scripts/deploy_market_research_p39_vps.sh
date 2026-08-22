#!/usr/bin/env bash
# Deploy Market Research OS P39 — RAG re-embed backfill staging playbook (RES-UC-101).
#
# Forward path: verify pgvector (warn) → 1/2 DDL (P0–P38) → 2/2 api + worker.
# P39 does NOT rebuild ops-web or portal-web.
#
# Default: flags untouched (prod-safe).
# Staging UAT only: --enable-rag-staging sets RESEARCH_RAG_ENABLED,
#   RESEARCH_RAG_OPENAI_EMBED_ENABLED, RESEARCH_RAG_PGVECTOR_ENABLED=1
#   (does NOT set OPENAI_API_KEY — PO must add manually on VPS).
#
# One-time before staging ANN: bash scripts/install_pgvector_vps.sh (requires sudo)
#
# From laptop:
#   APPLY=1 ./scripts/deploy_market_research_p39_vps.sh
#   APPLY=1 ./scripts/deploy_market_research_p39_vps.sh --enable-rag-staging  # via REMOTE_ARGS on VPS
#
# On VPS:
#   cd /var/www/rnosai && git pull --ff-only origin main && bash scripts/deploy_market_research_p39_vps.sh --local
#   bash scripts/deploy_market_research_p39_vps.sh --local --enable-rag-staging
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VPS_HOST="${PTT_VPS_HOST:-rs.pttads.vn}"
VPS_USER="${PTT_VPS_USER:-deploy}"
VPS_ROOT="${PTT_VPS_ROOT:-/var/www/rnosai}"
APPLY="${APPLY:-0}"
ENABLE_RAG_STAGING=0

for arg in "$@"; do
  if [[ "$arg" == "--enable-rag-staging" ]]; then
    ENABLE_RAG_STAGING=1
  fi
done

patch_rag_staging_env() {
  local env_file="$1"
  [[ -f "$env_file" ]] || return 0
  [[ -w "$env_file" ]] || {
    echo "SKIP  $env_file (not writable)"
    return 0
  }
  for kv in \
    "RESEARCH_RAG_ENABLED=1" \
    "RESEARCH_RAG_OPENAI_EMBED_ENABLED=1" \
    "RESEARCH_RAG_PGVECTOR_ENABLED=1"; do
    local key="${kv%%=*}"
    if grep -q "^${key}=" "$env_file" 2>/dev/null; then
      sed -i.bak "s|^${key}=.*|${kv}|" "$env_file"
    else
      echo "$kv" >> "$env_file"
    fi
  done
}

run_local() {
  echo "== Market Research P39 deploy @ $(git -C "$ROOT" rev-parse --short HEAD) =="
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
    echo "WARN  pgvector not ready — run: bash scripts/install_pgvector_vps.sh (sudo)"
  fi

  echo "== 1/2 Apply Market Research P0–P7 + P10 + P11 + P13 + P20 + P21 + P23 + P36 + P38 DDL =="
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
  bash "$ROOT/scripts/apply_pg_ddl_market_research_p38.sh"

  if [[ "$ENABLE_RAG_STAGING" == "1" ]]; then
    echo "== flags --enable-rag-staging (staging/UAT only; OPENAI_API_KEY untouched) =="
    mkdir -p "$ROOT/deploy"
    touch "$ROOT/deploy/runtime.env"
    patch_rag_staging_env "$ROOT/deploy/runtime.env"
    patch_rag_staging_env "$ROOT/.env"
    echo " NOTE  PO must set OPENAI_API_KEY in .env manually; then restart api + worker"
  else
    echo "== flags untouched (RAG + OpenAI embed + pgvector stay off) =="
  fi

  echo "== 2/2 ptt-crm-api + worker =="
  cd "$ROOT/services/ptt-crm-api"
  npm ci
  export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=2048}"
  npm run build
  npm test -- --testPathPattern='market-research|portal-research' --passWithNoTests --no-coverage
  sudo -n /usr/bin/systemctl restart ptt-crm-api 2>/dev/null || true
  sleep 3
  curl -sf http://127.0.0.1:3000/health -o /dev/null && echo " api OK" || echo "WARN  api health check failed"

  sudo -n /usr/bin/systemctl restart ptt-worker 2>/dev/null || true
  sleep 2
  systemctl is-active ptt-worker >/dev/null 2>&1 && echo " worker OK" \
    || echo "WARN  ptt-worker restart failed or not on VPS"

  echo "== Market Research P39 deploy complete =="
  echo "UAT: bash scripts/smoke_market_research_p39.sh"
  echo "Runbook: docs/runbooks/market-research-rag-staging-backfill.md"
}

REMOTE_ARGS="--local"
if [[ "$ENABLE_RAG_STAGING" == "1" ]]; then
  REMOTE_ARGS="--local --enable-rag-staging"
fi

if [[ "${1:-}" == "--local" ]]; then
  run_local
elif [[ "$APPLY" == "1" ]]; then
  ssh "${VPS_USER}@${VPS_HOST}" "cd ${VPS_ROOT} && git pull --ff-only origin main && bash scripts/deploy_market_research_p39_vps.sh ${REMOTE_ARGS}"
else
  echo "Dry-run. Set APPLY=1 to deploy to ${VPS_USER}@${VPS_HOST}:${VPS_ROOT}"
  echo "Staging RAG: pass --enable-rag-staging after PO sign-off (OPENAI_API_KEY manual)"
  echo "Or on VPS: bash scripts/deploy_market_research_p39_vps.sh --local"
fi
