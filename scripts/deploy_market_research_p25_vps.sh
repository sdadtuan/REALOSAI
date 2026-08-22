#!/usr/bin/env bash
# Deploy Market Research OS P25 — P0–P23 stack + portal RAG «Chỉ hết hạn» filter.
#
# Forward path: 1/3 DDL (P0–P7 + P10 + P11 + P13 + P20 fail-soft + P21 + P23) → 2/3 api → 3/3 portal-web.
# P25 rebuilds portal-web (like P24); ops-web unchanged. No P25 DDL.
#
# Do NOT set RESEARCH_TALKWALKER_ENABLED / TALKWALKER_ACCESS_TOKEN.
# Do NOT set RAG / OpenAI embed / pgvector flags.
#
# Merge this branch to main before VPS. APPLY=1 pulls origin main only.
#
# From laptop:
#   APPLY=1 ./scripts/deploy_market_research_p25_vps.sh
#
# On VPS:
#   cd /var/www/rnosai && git pull --ff-only origin main && bash scripts/deploy_market_research_p25_vps.sh --local
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
  echo "== Market Research P25 deploy @ $(git -C "$ROOT" rev-parse --short HEAD) =="
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

  echo "== 1/3 Apply Market Research P0–P7 + P10 + P11 + P13 + P20 fail-soft + P21 + P23 DDL =="
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

  if [[ "$ENABLE_FLAGS" == "1" ]]; then
    echo "== flags --enable-flags (staging/UAT only; Talkwalker + RAG + pgvector untouched) =="
    mkdir -p "$ROOT/deploy"
    touch "$ROOT/deploy/runtime.env"
    patch_runtime_env "$ROOT/deploy/runtime.env"
    patch_runtime_env "$ROOT/.env"
  else
    echo "== flags untouched (Talkwalker + RAG + OpenAI embed + pgvector stay off) =="
  fi

  echo "== 2/3 ptt-crm-api =="
  cd "$ROOT/services/ptt-crm-api"
  npm ci
  npm run build
  npm test -- --testPathPattern='market-research|portal-research' --passWithNoTests --no-coverage
  sudo -n /usr/bin/systemctl restart ptt-crm-api 2>/dev/null || true
  sleep 3
  curl -sf http://127.0.0.1:3000/health -o /dev/null && echo " api OK" || echo "WARN  api health check failed"

  echo "== 3/3 portal-web =="
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

  echo "== Market Research P25 deploy complete =="
  echo "UAT: bash scripts/smoke_market_research_p25.sh"
}

REMOTE_ARGS="--local"
if [[ "$ENABLE_FLAGS" == "1" ]]; then
  REMOTE_ARGS="--local --enable-flags"
fi

if [[ "${1:-}" == "--local" ]]; then
  run_local
elif [[ "$APPLY" == "1" ]]; then
  ssh "${VPS_USER}@${VPS_HOST}" "cd ${VPS_ROOT} && git pull --ff-only origin main && bash scripts/deploy_market_research_p25_vps.sh ${REMOTE_ARGS}"
else
  echo "Dry-run. Set APPLY=1 to deploy to ${VPS_USER}@${VPS_HOST}:${VPS_ROOT}"
  echo "Or on VPS: bash scripts/deploy_market_research_p25_vps.sh --local"
fi
