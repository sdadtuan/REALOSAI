#!/usr/bin/env bash
# Video SOP S7 — DDL cost ledger + API + ops-web SC-11 on VPS
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VPS_HOST="${PTT_VPS_HOST:-rs.pttads.vn}"
VPS_USER="${PTT_VPS_USER:-deploy}"
VPS_ROOT="${PTT_VPS_ROOT:-/var/www/rnosai}"
APPLY="${APPLY:-0}"

run_local() {
  cd "$ROOT"
  echo "== Video SOP S7 @ $(git rev-parse --short HEAD 2>/dev/null || echo unknown) =="

  if [[ -f "$ROOT/.env" ]]; then
    set -a
    # shellcheck disable=SC1091
    source "$ROOT/.env"
    set +a
  fi

  echo "== 1/5 Apply S7 PG DDL (vd_cost_ledger, vd_budgets extend) =="
  bash "$ROOT/scripts/apply_pg_ddl_vd_sop_s7.sh"

  echo "== 2/5 Ensure cinematic flags =="
  RUNTIME_ENV="$ROOT/deploy/runtime.env"
  mkdir -p "$ROOT/deploy"
  touch "$RUNTIME_ENV"
  for kv in \
    "PTT_CMKT_VIDEO_CINEMATIC=1" \
    "NEXT_PUBLIC_CMKT_VIDEO_CINEMATIC=1"; do
    key="${kv%%=*}"
    if grep -q "^${key}=" "$RUNTIME_ENV" 2>/dev/null; then
      sed -i.bak "s|^${key}=.*|${kv}|" "$RUNTIME_ENV"
    else
      echo "$kv" >>"$RUNTIME_ENV"
    fi
  done

  echo "== 3/5 Build + restart Nest API =="
  if [[ -d "$ROOT/services/ptt-crm-api" ]]; then
    BUILD="$ROOT/.build-ptt-crm-api-vd-s7"
    rm -rf "$BUILD"
    mkdir -p "$BUILD"
    rsync -a --exclude node_modules "$ROOT/services/ptt-crm-api/" "$BUILD/"
    cd "$BUILD"
    npm ci
    export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=6144}"
    npx nest build
    rsync -a dist/ "$ROOT/services/ptt-crm-api/dist/"
    rm -rf "$BUILD"
  fi
  if sudo -n /usr/bin/systemctl restart ptt-crm-api 2>/dev/null; then
    sleep 3
    curl -sf http://127.0.0.1:3000/health && echo " Nest OK"
  else
    echo "SKIP systemd restart"
  fi

  echo "== 4/5 Build + publish ops-web (SC-11 cost) =="
  if [[ -x "$ROOT/scripts/deploy_ops_web.sh" ]]; then
    export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=4096}"
    NEXT_PUBLIC_CMKT_VIDEO_CINEMATIC=1 bash "$ROOT/scripts/deploy_ops_web.sh" build
    sudo -n "$ROOT/scripts/deploy_ops_web.sh" --restart 2>/dev/null || echo "WARN ops-web restart skipped"
  fi

  echo "== 5/5 Smoke S7 (BR-06 budget reserve) =="
  export PTT_API_URL="${PTT_API_URL:-http://127.0.0.1:3000}"
  export PTT_CRM_INTERNAL_KEY="${PTT_CRM_INTERNAL_KEY:-}"
  export LIFECYCLE_ID="${LIFECYCLE_ID:-3}"
  bash "$ROOT/scripts/smoke_video_sop_s7.sh"

  echo "== Video SOP S7 deploy complete =="
  echo "UI: /crm/video/{id}/cost"
}

if [[ "${1:-}" == "--local" ]]; then
  run_local
elif [[ "$APPLY" == "1" ]]; then
  ssh "${VPS_USER}@${VPS_HOST}" "cd ${VPS_ROOT} && git pull --ff-only origin main && bash scripts/deploy_video_sop_s7_vps.sh --local"
else
  echo "Dry-run. Set APPLY=1 to deploy on ${VPS_USER}@${VPS_HOST}:${VPS_ROOT}"
fi
