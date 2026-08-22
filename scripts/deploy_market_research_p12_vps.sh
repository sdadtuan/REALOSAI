#!/usr/bin/env bash
# Deploy Market Research OS P12 — P0–P11 stack + Portal RAG (no new DDL).
#
# Forward path: 1/5 DDL (P0–P7 + P10 + P11) → 2/5 api → 3/5 ops-web → 4/5 portal-web → 5/5 worker.
# P12 rebuilds portal-web (unlike P8–P11).
#
# Merge this branch to main before VPS. APPLY=1 pulls origin main only.
#
# From laptop:
#   APPLY=1 ./scripts/deploy_market_research_p12_vps.sh
#
# On VPS:
#   cd /var/www/rnosai && git pull --ff-only origin main && bash scripts/deploy_market_research_p12_vps.sh --local
#
# Do NOT flip flags by default. Explicit opt-in only:
#   bash scripts/deploy_market_research_p12_vps.sh --local --enable-flags
# --enable-flags writes P0 research flags only. It does NOT set
# RESEARCH_RAG_ENABLED=1, RESEARCH_RAG_OPENAI_EMBED_ENABLED=1,
# RESEARCH_QUALTRICS_ENABLED=1, RESEARCH_SPARKTORO_ENABLED=1,
# and does NOT write OPENAI_API_KEY, QUALTRICS_API_KEY, QUALTRICS_DATACENTER, or SPARKTORO_API_KEY.
#
# Staging UAT Portal RAG (manual, after PO):
#   RESEARCH_RAG_ENABLED=1
#   sudo systemctl restart ptt-crm-api
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VPS_HOST="${PTT_VPS_HOST:-rs.pttads.vn}"
VPS_USER="${PTT_VPS_USER:-deploy}"
VPS_ROOT="${PTT_VPS_ROOT:-/var/www/rnosai}"
APPLY="${APPLY:-0}"
ENABLE_FLAGS=0

for arg in "$@"; do
  if [[ "$arg" == "--enable-flags" ]]; then
    ENABLE_FLAGS=1
  fi
done

patch_runtime_env() {
  local env_file="$1"
  [[ -f "$env_file" ]] || return 0
  [[ -w "$env_file" ]] || {
    echo "SKIP  $env_file (not writable)"
    return 0
  }
  for kv in \
    "PTT_MARKET_RESEARCH_ENABLED=1" \
    "NEXT_PUBLIC_MARKET_RESEARCH=1"; do
    key="${kv%%=*}"
    if grep -q "^${key}=" "$env_file" 2>/dev/null; then
      sed -i.bak "s|^${key}=.*|${kv}|" "$env_file"
    else
      echo "$kv" >> "$env_file"
    fi
  done
}

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
  echo "== Market Research P12 deploy @ $(git -C "$ROOT" rev-parse --short HEAD) =="
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

  echo "== 1/5 Apply Market Research P0 + P1 + P2 + P3 + P4 + P5 + P6 + P7 + P10 + P11 DDL =="
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

  if [[ "$ENABLE_FLAGS" == "1" ]]; then
    echo "== flags --enable-flags (staging/UAT only; RAG + OpenAI embed + Qualtrics + SparkToro stay off) =="
    mkdir -p "$ROOT/deploy"
    touch "$ROOT/deploy/runtime.env"
    patch_runtime_env "$ROOT/deploy/runtime.env"
    patch_runtime_env "$ROOT/.env"
  else
    echo "== flags untouched (P0 on; RAG + OpenAI embed + Qualtrics + SparkToro stay off) =="
  fi

  echo "== 2/5 ptt-crm-api =="
  cd "$ROOT/services/ptt-crm-api"
  npm ci
  npm run build
  npm test -- --testPathPattern='market-research|portal-research' --passWithNoTests --no-coverage
  sudo -n /usr/bin/systemctl restart ptt-crm-api 2>/dev/null || true
  sleep 3
  curl -sf http://127.0.0.1:3000/health -o /dev/null && echo " api OK" || echo "WARN  api health check failed"

  echo "== 3/5 ops-web =="
  cd "$ROOT"
  if [[ "$ENABLE_FLAGS" == "1" ]]; then
    export NEXT_PUBLIC_MARKET_RESEARCH=1
  else
    export_public_flag_from_runtime
  fi
  export NEXT_PUBLIC_PTT_API_URL="${NEXT_PUBLIC_PTT_API_URL:-https://rs.pttads.vn}"
  "$ROOT/scripts/deploy_ops_web.sh" build
  sudo -n /usr/bin/systemctl restart ptt-ops-web 2>/dev/null || true
  sleep 2
  curl -sf http://127.0.0.1:3200/login -o /dev/null && echo " ops-web OK" || echo "WARN  ops-web health check failed"

  echo "== 4/5 portal-web (rebuild + restart) =="
  cd "$ROOT"
  if [[ "$ENABLE_FLAGS" == "1" ]]; then
    export NEXT_PUBLIC_MARKET_RESEARCH=1
  else
    export_public_flag_from_runtime
  fi
  export NEXT_PUBLIC_PTT_API_URL="${NEXT_PUBLIC_PTT_API_URL:-https://rs.pttads.vn}"
  bash "$ROOT/scripts/wave_p1_rebuild_portal_web.sh"
  sudo -n /usr/bin/systemctl restart ptt-portal-web 2>/dev/null || true
  sleep 2
  systemctl is-active ptt-portal-web >/dev/null 2>&1 && echo " portal-web OK" \
    || echo "WARN  ptt-portal-web restart failed or not on VPS"

  echo "== 5/5 worker =="
  sudo -n /usr/bin/systemctl restart ptt-worker 2>/dev/null || true
  sleep 2
  systemctl is-active ptt-worker >/dev/null 2>&1 && echo " worker OK" \
    || echo "WARN  ptt-worker restart failed or not on VPS"

  echo "== Market Research P12 deploy complete =="
  echo "Portal RAG not enabled by this script. Staging: PO sets RESEARCH_RAG_ENABLED manually."
  echo "UAT: bash scripts/smoke_market_research_p12.sh"
}

REMOTE_ARGS="--local"
if [[ "$ENABLE_FLAGS" == "1" ]]; then
  REMOTE_ARGS="--local --enable-flags"
fi

if [[ "${1:-}" == "--local" ]]; then
  run_local
elif [[ "$APPLY" == "1" ]]; then
  ssh "${VPS_USER}@${VPS_HOST}" "cd ${VPS_ROOT} && git pull --ff-only origin main && bash scripts/deploy_market_research_p12_vps.sh ${REMOTE_ARGS}"
else
  echo "Dry-run. Set APPLY=1 to deploy to ${VPS_USER}@${VPS_HOST}:${VPS_ROOT}"
  echo "Or on VPS: bash scripts/deploy_market_research_p12_vps.sh --local"
  echo "Do not set RESEARCH_RAG_ENABLED or RESEARCH_RAG_OPENAI_EMBED_ENABLED on prod deploy."
fi
