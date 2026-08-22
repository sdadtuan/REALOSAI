#!/usr/bin/env bash
# RNOS-43A — Playwright KPI dashboard v2 smoke
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

ENV_FILE="${RNOS43A_ENV:-$ROOT/deploy/env.local.example}"
if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE" 2>/dev/null || true
  set +a
fi

export OPS_E2E_URL="${OPS_E2E_URL:-http://127.0.0.1:3200}"
export OPS_E2E_API_URL="${OPS_E2E_API_URL:-http://127.0.0.1:3000}"
export OPS_E2E_SKIP_SERVER="${OPS_E2E_SKIP_SERVER:-0}"
export OPS_E2E_USE_DEV="${OPS_E2E_USE_DEV:-1}"
export NEXT_PUBLIC_PTT_API_URL="${NEXT_PUBLIC_PTT_API_URL:-$OPS_E2E_API_URL}"
export OPS_E2E_STAFF_EMAIL="${OPS_E2E_STAFF_EMAIL:-staff@demo.local}"
export OPS_E2E_STAFF_PASSWORD="${OPS_E2E_STAFF_PASSWORD:-demo12345}"

API_PID=""

_wait_http() {
  local url="$1" label="$2" tries="${3:-60}"
  for _ in $(seq 1 "$tries"); do
    if curl -sf "$url" >/dev/null 2>&1; then
      echo "OK  $label → $url"
      return 0
    fi
    sleep 1
  done
  echo "FAIL $label not reachable: $url" >&2
  return 1
}

cleanup() {
  [[ -n "$API_PID" ]] && kill "$API_PID" 2>/dev/null || true
}
trap cleanup EXIT

if ! curl -sf "${OPS_E2E_API_URL}/api/v1/ai/health" >/dev/null 2>&1; then
  NEED_API_START=1
else
  TREND_CODE="$(curl -s -o /dev/null -w '%{http_code}' "${OPS_E2E_API_URL}/api/crm/kpi/trend?metric_id=1" || echo 000)"
  if [[ "$TREND_CODE" == "404" || "$TREND_CODE" == "000" ]]; then
    echo "WARN  KPI trend API not available (HTTP $TREND_CODE) — restarting Nest API"
    NEED_API_START=1
  else
    NEED_API_START=0
    echo "OK  Nest API already running"
  fi
fi

if [[ "${NEED_API_START:-0}" == "1" ]]; then
  echo "==> Start ptt-crm-api for KPI dashboard E2E"
  (
    cd "$ROOT/services/ptt-crm-api"
    if [[ ! -d node_modules ]]; then npm ci; fi
    npm run build
    export DATABASE_URL="${DATABASE_URL:-postgresql://ptt:ptt_dev@127.0.0.1:5433/rnosaidb}"
    export PTT_SQLITE_PATH="${PTT_SQLITE_PATH:-$ROOT/ptt.db}"
    export NODE_ENV=development PORT=3000
    export PTT_STAFF_ALLOW_STUB=1
    export PTT_STAFF_STUB_USERS="${OPS_E2E_STAFF_EMAIL}:${OPS_E2E_STAFF_PASSWORD}:1:1:E2E RNOS43A"
    export PTT_STAFF_JWT_SECRET="${PTT_STAFF_JWT_SECRET:-rnos43a-e2e-staff-jwt-secret-min-32-chars}"
    npm run start:prod
  ) >/tmp/rnos43a-api.log 2>&1 &
  API_PID=$!
  _wait_http "${OPS_E2E_API_URL}/api/v1/ai/health" "Nest API" 120
fi

echo "==> Playwright RNOS-43A KPI dashboard v2"
(
  cd "$ROOT/services/ops-web"
  if [[ ! -d node_modules ]]; then npm ci; fi
  npm run test:e2e:kpi-dashboard-v2
)
