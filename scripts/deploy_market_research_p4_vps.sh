#!/usr/bin/env bash
# Deploy Market Research OS P4 — P0+P1+P2+P3+P4 DDL + API + ops-web + portal-web + worker.
#
# Ordering: P4 DDL MUST apply before api / ops-web / portal-web / worker restart.
# published_by / published_at must exist before the new API starts.
# Forward path already applies DDL as 1/5 and worker as 5/5 — do not change that order.
# Step 1/5: P0 + P1 + P2 + P3 + P4 DDL (P4 last, still before npm/build/restarts).
#
# From laptop:
#   APPLY=1 ./scripts/deploy_market_research_p4_vps.sh
#
# On VPS:
#   cd /var/www/rnosai && git pull origin main && bash scripts/deploy_market_research_p4_vps.sh --local
#
# Do NOT flip flags by default (P0 already on). Explicit opt-in only:
#   bash scripts/deploy_market_research_p4_vps.sh --local --enable-flags
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

# Export existing NEXT_PUBLIC_MARKET_RESEARCH from runtime.env for Next builds.
# Does not write or flip the file (no-op if already 1).
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
  echo "== Market Research P4 deploy @ $(git -C "$ROOT" rev-parse --short HEAD) =="
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

  echo "== 1/5 Apply Market Research P0 + P1 + P2 + P3 + P4 DDL (P4 DDL before restarts) =="
  bash "$ROOT/scripts/apply_pg_ddl_market_research.sh"
  bash "$ROOT/scripts/apply_pg_ddl_market_research_p1.sh"
  bash "$ROOT/scripts/apply_pg_ddl_market_research_p2.sh"
  bash "$ROOT/scripts/apply_pg_ddl_market_research_p3.sh"
  bash "$ROOT/scripts/apply_pg_ddl_market_research_p4.sh"

  if [[ "$ENABLE_FLAGS" == "1" ]]; then
    echo "== flags --enable-flags (staging/UAT only; not default) =="
    mkdir -p "$ROOT/deploy"
    touch "$ROOT/deploy/runtime.env"
    patch_runtime_env "$ROOT/deploy/runtime.env"
    patch_runtime_env "$ROOT/.env"
  else
    echo "== flags untouched by default (P0 already on; pass --enable-flags only as explicit opt-in) =="
  fi

  echo "== 2/5 ptt-crm-api (npm ci, not --omit=dev) =="
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

  echo "== Market Research P4 deploy complete =="
  echo "Flags not flipped unless --enable-flags. UAT: bash scripts/smoke_market_research_p4.sh"
}

REMOTE_ARGS="--local"
if [[ "$ENABLE_FLAGS" == "1" ]]; then
  REMOTE_ARGS="--local --enable-flags"
fi

if [[ "${1:-}" == "--local" ]]; then
  run_local
elif [[ "$APPLY" == "1" ]]; then
  ssh "${VPS_USER}@${VPS_HOST}" "cd ${VPS_ROOT} && git pull --ff-only origin main && bash scripts/deploy_market_research_p4_vps.sh ${REMOTE_ARGS}"
else
  echo "Dry-run. Set APPLY=1 to deploy to ${VPS_USER}@${VPS_HOST}:${VPS_ROOT}"
  echo "Or on VPS: bash scripts/deploy_market_research_p4_vps.sh --local"
  echo "Do not flip flags by default (P0 already on). Enable only with --enable-flags after PO sign-off."
fi
