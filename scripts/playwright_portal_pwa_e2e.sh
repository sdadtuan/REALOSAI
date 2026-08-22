#!/usr/bin/env bash
# RNOS-M2 — Playwright Portal PWA E2E
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

ENV_FILE="${RNOS_M2_ENV:-$ROOT/deploy/env.staging-m2-portal-pwa.example}"
if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE" 2>/dev/null || true
  set +a
fi

export PORTAL_E2E_URL="${PORTAL_E2E_URL:-http://127.0.0.1:3100}"
export PORTAL_E2E_API_URL="${PORTAL_E2E_API_URL:-http://127.0.0.1:3000}"
export NEXT_PUBLIC_PWA_ENABLED="${NEXT_PUBLIC_PWA_ENABLED:-1}"
export NEXT_PUBLIC_PTT_API_URL="${NEXT_PUBLIC_PTT_API_URL:-$PORTAL_E2E_API_URL}"
export PORTAL_E2E_APPROVER_EMAIL="${PORTAL_E2E_APPROVER_EMAIL:-approver@demo.local}"
export PORTAL_E2E_APPROVER_PASSWORD="${PORTAL_E2E_APPROVER_PASSWORD:-demo123}"

API_PID=""
PORTAL_PID=""

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
  [[ -n "$PORTAL_PID" ]] && kill "$PORTAL_PID" 2>/dev/null || true
}
trap cleanup EXIT

if ! curl -sf "${PORTAL_E2E_API_URL}/health" >/dev/null 2>&1; then
  echo "==> Start ptt-crm-api (stub portal approver for E2E)"
  (
    cd "$ROOT/services/ptt-crm-api"
    if [[ ! -d node_modules ]]; then npm ci; fi
    npm run build
    export DATABASE_URL="${DATABASE_URL:-postgresql://ptt:ptt_dev@127.0.0.1:5433/rnosaidb}"
    export PTT_LEADS_READ_SOURCE="${PTT_LEADS_READ_SOURCE:-pg}"
    export NODE_ENV=development PORT=3000
    export PTT_PORTAL_ALLOW_STUB=1
    export PTT_PORTAL_STUB_USERS="${PORTAL_E2E_APPROVER_EMAIL}:${PORTAL_E2E_APPROVER_PASSWORD}:550e8400-e29b-41d4-a716-446655440000:approver"
    export PTT_PORTAL_JWT_SECRET="${PTT_PORTAL_JWT_SECRET:-rnos-m2-e2e-portal-jwt-secret-min-32-chars}"
    export PTT_CRM_INTERNAL_KEY="${PTT_CRM_INTERNAL_KEY:-rnos-m2-e2e-internal-key}"
    export PTT_PORTAL_CORS_ORIGINS="${PTT_PORTAL_CORS_ORIGINS:-http://127.0.0.1:3100,http://localhost:3100}"
    npm run start:prod
  ) >/tmp/rnos-m2-api.log 2>&1 &
  API_PID=$!
  _wait_http "${PORTAL_E2E_API_URL}/health" "Nest API" 120
else
  echo "OK  Nest API already running"
fi

if ! curl -sf "${PORTAL_E2E_URL}/manifest.webmanifest" >/dev/null 2>&1 || [[ "${PORTAL_E2E_RESTART_WEB:-1}" == "1" ]]; then
  if curl -sf "${PORTAL_E2E_URL}/manifest.webmanifest" >/dev/null 2>&1; then
    echo "==> Restart portal-web with E2E API URL"
    lsof -ti ":${PORTAL_PORT:-3100}" 2>/dev/null | xargs kill 2>/dev/null || true
    sleep 1
  else
    echo "==> Start portal-web for E2E"
  fi
  (
    cd "$ROOT/services/portal-web"
    export PORTAL_PORT="${PORTAL_PORT:-$(node -e "console.log(new URL(process.argv[1]).port||3100)" "$PORTAL_E2E_URL")}"
    export NEXT_PUBLIC_PTT_API_URL="$PORTAL_E2E_API_URL"
    export NEXT_PUBLIC_PWA_ENABLED=1
    npm run dev
  ) >/tmp/rnos-m2-portal-web.log 2>&1 &
  PORTAL_PID=$!
  _wait_http "${PORTAL_E2E_URL}/manifest.webmanifest" "portal-web" 90 || {
    echo "FAIL  portal-web did not start — see /tmp/rnos-m2-portal-web.log"
    exit 1
  }
fi

cd "$ROOT/services/portal-web"
npx playwright test e2e/pwa-rnos-m2.spec.ts
