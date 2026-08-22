#!/usr/bin/env bash
# Deploy Market Research OS P46 — portal report list stale filter (RES-UC-108).
#
# Forward path: portal-web only (client-side filter; no API/DDL change).
# Flags untouched (prod-safe).
#
# From laptop:
#   APPLY=1 ./scripts/deploy_market_research_p46_vps.sh
#
# On VPS:
#   cd /var/www/rnosai && git pull --ff-only origin main && bash scripts/deploy_market_research_p46_vps.sh --local
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
  echo "== Market Research P46 deploy @ $(git -C "$ROOT" rev-parse --short HEAD) =="
  cd "$ROOT"

  echo "== flags untouched (RAG + OpenAI embed + pgvector stay off) =="

  echo "== 1/1 portal-web =="
  export_public_flag_from_runtime
  export NEXT_PUBLIC_PTT_API_URL="${NEXT_PUBLIC_PTT_API_URL:-https://rs.pttads.vn}"
  bash "$ROOT/scripts/wave_p1_rebuild_portal_web.sh"
  sudo -n /usr/bin/systemctl restart ptt-portal-web 2>/dev/null || true
  sleep 2
  systemctl is-active ptt-portal-web >/dev/null 2>&1 && echo " portal-web OK" \
    || echo "WARN  ptt-portal-web restart failed or not on VPS"

  echo "== Market Research P46 deploy complete =="
  echo "UAT: bash scripts/smoke_market_research_p46.sh"
}

if [[ "${1:-}" == "--local" ]]; then
  run_local
elif [[ "$APPLY" == "1" ]]; then
  ssh "${VPS_USER}@${VPS_HOST}" "cd ${VPS_ROOT} && git pull --ff-only origin main && bash scripts/deploy_market_research_p46_vps.sh --local"
else
  echo "Dry-run. Set APPLY=1 to deploy to ${VPS_USER}@${VPS_HOST}:${VPS_ROOT}"
  echo "Or on VPS: bash scripts/deploy_market_research_p46_vps.sh --local"
fi
