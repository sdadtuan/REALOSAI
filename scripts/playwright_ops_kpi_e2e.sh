#!/usr/bin/env bash
# RNOS-42 — Playwright KPI dashboard UX smoke
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

ENV_FILE="${RNOS42_ENV:-$ROOT/deploy/env.local.example}"
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

_ops_web_login_ok() {
  local code
  code="$(curl -s -o /dev/null -w '%{http_code}' "${OPS_E2E_URL}/login" 2>/dev/null || echo 000)"
  [[ "$code" == "200" ]]
}

_free_ops_web_port_if_stale() {
  if _ops_web_login_ok; then
    return 0
  fi
  local port
  port="$(node -e "console.log(new URL(process.argv[1]).port||3200)" "$OPS_E2E_URL")"
  local pids
  pids="$(lsof -ti tcp:"$port" 2>/dev/null || true)"
  if [[ -n "$pids" ]]; then
    echo "WARN  Stale ops-web on :$port (login HTTP != 200) — stopping $pids"
    kill $pids 2>/dev/null || true
    sleep 2
  fi
}

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
  echo "==> Start ptt-crm-api (stub staff for E2E login)"
  (
    cd "$ROOT/services/ptt-crm-api"
    if [[ ! -d node_modules ]]; then npm ci; fi
    npm run build
    export DATABASE_URL="${DATABASE_URL:-postgresql://ptt:ptt_dev@127.0.0.1:5433/rnosaidb}"
    export PTT_LEADS_READ_SOURCE="${PTT_LEADS_READ_SOURCE:-pg}"
    export PTT_SQLITE_PATH="${PTT_SQLITE_PATH:-$ROOT/ptt.db}"
    export NODE_ENV=development PORT=3000
    export PTT_AI_COPILOT_ENABLED=1
    export PTT_STAFF_ALLOW_STUB=1
    export PTT_STAFF_STUB_USERS="${OPS_E2E_STAFF_EMAIL}:${OPS_E2E_STAFF_PASSWORD}:1:1:E2E KPI"
    export PTT_STAFF_JWT_SECRET="${PTT_STAFF_JWT_SECRET:-rnos42-e2e-staff-jwt-secret-min-32-chars}"
    export PTT_CRM_INTERNAL_KEY="${PTT_CRM_INTERNAL_KEY:-rnos42-e2e-internal-key}"
    npm run start:prod
  ) >/tmp/rnos42-api.log 2>&1 &
  API_PID=$!
  _wait_http "${OPS_E2E_API_URL}/api/v1/ai/health" "Nest API" 120
else
  echo "OK  Nest API already running"
fi

_free_ops_web_port_if_stale

echo "==> Playwright RNOS-42 KPI UX (ops-web via playwright webServer on ${OPS_E2E_URL})"
(
  cd "$ROOT/services/ops-web"
  if [[ ! -d node_modules ]]; then npm ci; fi
  npm run test:e2e:kpi
)
