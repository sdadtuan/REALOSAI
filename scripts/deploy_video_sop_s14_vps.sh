#!/usr/bin/env bash
# Video SOP S14 — Topaz async + video saga + cost actuals on VPS
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VPS_HOST="${PTT_VPS_HOST:-rs.pttads.vn}"
VPS_USER="${PTT_VPS_USER:-deploy}"
VPS_ROOT="${PTT_VPS_ROOT:-/var/www/rnosai}"
APPLY="${APPLY:-0}"

run_local() {
  cd "$ROOT"
  echo "== Video SOP S14 @ $(git rev-parse --short HEAD 2>/dev/null || echo unknown) =="

  if [[ -f "$ROOT/.env" ]]; then
    set -a
    # shellcheck disable=SC1091
    source "$ROOT/.env"
    set +a
  fi

  echo "== 1/5 Apply S14 PG DDL (no-op) =="
  bash "$ROOT/scripts/apply_pg_ddl_vd_sop_s14.sh"

  echo "== 2/5 Build + restart Nest API =="
  if [[ -d "$ROOT/services/ptt-crm-api" ]]; then
    BUILD="$ROOT/.build-ptt-crm-api-vd-s14"
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

  echo "== 3/5 Build + publish ops-web =="
  if [[ -x "$ROOT/scripts/deploy_ops_web.sh" ]]; then
    export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=4096}"
    NEXT_PUBLIC_CMKT_VIDEO_CINEMATIC=1 bash "$ROOT/scripts/deploy_ops_web.sh" build
    sudo -n "$ROOT/scripts/deploy_ops_web.sh" --restart 2>/dev/null || echo "WARN ops-web restart skipped"
  fi

  echo "== 4/5 Smoke S14 + S13 regression =="
  export PTT_API_URL="${PTT_API_URL:-http://127.0.0.1:3000}"
  export PTT_CRM_INTERNAL_KEY="${PTT_CRM_INTERNAL_KEY:-}"
  export LIFECYCLE_ID="${LIFECYCLE_ID:-3}"
  bash "$ROOT/scripts/smoke_video_sop_s14.sh"
  bash "$ROOT/scripts/smoke_video_sop_s13.sh"

  echo "== 5/5 S14 plan present =="
  test -f "$ROOT/docs/superpowers/plans/2026-08-21-video-sop-l5-adapters.md"

  echo "== Video SOP S14 deploy complete =="
}

if [[ "${1:-}" == "--local" ]]; then
  run_local
elif [[ "$APPLY" == "1" ]]; then
  ssh "${VPS_USER}@${VPS_HOST}" "cd ${VPS_ROOT} && git pull --ff-only origin main && bash scripts/deploy_video_sop_s14_vps.sh --local"
else
  echo "Dry-run. Set APPLY=1 to deploy on ${VPS_USER}@${VPS_HOST}:${VPS_ROOT}"
fi
