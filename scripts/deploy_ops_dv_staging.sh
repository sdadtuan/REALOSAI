#!/usr/bin/env bash
# Ops DV M0 — DDL + catalog seed + Hub flags on staging VPS (rs.pttads.vn)
#
# From laptop:
#   APPLY=1 ./scripts/deploy_ops_dv_staging.sh
#
# On VPS directly:
#   cd /var/www/rnosai && bash scripts/deploy_ops_dv_staging.sh --local
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VPS_HOST="${PTT_VPS_HOST:-rs.pttads.vn}"
VPS_USER="${PTT_VPS_USER:-deploy}"
VPS_ROOT="${PTT_VPS_ROOT:-/var/www/rnosai}"
APPLY="${APPLY:-0}"

run_local() {
  cd "$ROOT"
  echo "== Ops DV M0 staging @ $(git rev-parse --short HEAD 2>/dev/null || echo unknown) =="

  if [[ -f "$ROOT/.env" ]]; then
    set -a
    # shellcheck disable=SC1091
    source "$ROOT/.env"
    set +a
  fi

  echo "== 1/5 Apply Ops DV DDL =="
  bash "$ROOT/scripts/apply_pg_ddl_ops_dv.sh"

  echo "== 2/5 Seed ops_service_profile (21 DV) =="
  if [[ ! -d "$ROOT/services/ptt-crm-api/node_modules/pg" ]]; then
    (cd "$ROOT/services/ptt-crm-api" && npm ci)
  fi
  node "$ROOT/scripts/seed_ops_dv_catalog.js"

  # SPC S1 (optional): apply docs/specs/2026-08-12-postgresql-ddl-spc.sql then seed_spc_catalog.js

  echo "== 3/5 Enable API + FE flags =="
  RUNTIME_ENV="$ROOT/deploy/runtime.env"
  mkdir -p "$ROOT/deploy"
  touch "$RUNTIME_ENV"
  for kv in \
    "PTT_OPS_DV_ENABLED=1" \
    "PTT_OPS_WEEKLY_SPAWN=1" \
    "PTT_OPS_AGENT_ENABLED=1" \
    "PTT_OPS_PORTAL_SUMMARY=1" \
    "PTT_OPS_HUB_PILOT_DV=DV02,DV05,DV04,DV20" \
    "NEXT_PUBLIC_OPS_DV=1" \
    "NEXT_PUBLIC_OPS_PORTAL_SUMMARY=1"; do
    key="${kv%%=*}"
    if grep -q "^${key}=" "$RUNTIME_ENV" 2>/dev/null; then
      sed -i.bak "s|^${key}=.*|${kv}|" "$RUNTIME_ENV"
    else
      echo "$kv" >>"$RUNTIME_ENV"
    fi
  done
  echo "Updated $RUNTIME_ENV"

  echo "== 4/5 Build + restart Nest API + ops-web =="
  if [[ -d "$ROOT/services/ptt-crm-api" ]]; then
    (cd "$ROOT/services/ptt-crm-api" && npm ci && npm run build)
  fi
  if [[ -x "$ROOT/scripts/deploy_ops_web.sh" ]]; then
    NEXT_PUBLIC_OPS_DV=1 bash "$ROOT/scripts/deploy_ops_web.sh" --restart 2>/dev/null \
      || NEXT_PUBLIC_OPS_DV=1 bash "$ROOT/scripts/deploy_ops_web.sh" 2>/dev/null \
      || echo "WARN ops-web deploy skipped"
  fi
  if [[ -x "$ROOT/scripts/wave_b2_rebuild_portal_web.sh" ]]; then
    NEXT_PUBLIC_OPS_PORTAL_SUMMARY=1 bash "$ROOT/scripts/wave_b2_rebuild_portal_web.sh" 2>/dev/null \
      || echo "WARN portal-web rebuild skipped"
  fi
  if sudo -n /usr/bin/systemctl restart ptt-crm-api 2>/dev/null; then
    sleep 3
    curl -sf http://127.0.0.1:3000/health && echo " Nest OK"
  else
    echo "SKIP systemd restart (no passwordless sudo or not on VPS)"
    echo "     Manual: sudo systemctl restart ptt-crm-api"
  fi

  echo "== 5/5 Smoke GET /api/ops/catalog + hub =="
  export PTT_API_URL="${PTT_API_URL:-http://127.0.0.1:3000}"
  export CRM_API="${CRM_API:-$PTT_API_URL}"
  export ADMIN_EMAIL="${OPS_E2E_STAFF_EMAIL:-admin@pttads.vn}"
  export ADMIN_PASSWORD="${OPS_E2E_STAFF_PASSWORD:-${ADMIN_PASSWORD:-}}"
  export LIFECYCLE_ID="${LIFECYCLE_ID:-1}"
  if [[ -z "${STAFF_TOKEN:-}" && -n "${ADMIN_PASSWORD:-}" ]]; then
    STAFF_TOKEN="$(curl -sf -X POST "$CRM_API/api/crm/staff/login" \
      -H 'Content-Type: application/json' \
      -d "{\"email\":\"${ADMIN_EMAIL}\",\"password\":\"${ADMIN_PASSWORD}\"}" \
      | node -pe 'JSON.parse(require("fs").readFileSync(0,"utf8")).access_token' 2>/dev/null || true)"
    export STAFF_TOKEN
  fi
  if [[ -n "${STAFF_TOKEN:-}" ]]; then
    bash "$ROOT/scripts/smoke_ops_dv_hub.sh" || echo "WARN Ops M0 smoke failed — check LIFECYCLE_ID slug maps to DV"
  else
    echo "SKIP smoke — set STAFF_TOKEN or ADMIN_PASSWORD"
  fi

  echo "== Ops DV M0 staging complete =="
  echo "Tab: /crm/service-delivery/:id?tab=ops-hub"
}

if [[ "${1:-}" == "--local" ]]; then
  run_local
elif [[ "$APPLY" == "1" ]]; then
  echo "== SSH ${VPS_USER}@${VPS_HOST}:${VPS_ROOT} =="
  ssh "${VPS_USER}@${VPS_HOST}" "cd ${VPS_ROOT} && git pull --ff-only origin main && bash scripts/deploy_ops_dv_staging.sh --local"
else
  echo "Dry-run. Set APPLY=1 to run on ${VPS_USER}@${VPS_HOST}:${VPS_ROOT}"
  echo "Or on VPS: bash scripts/deploy_ops_dv_staging.sh --local"
fi
