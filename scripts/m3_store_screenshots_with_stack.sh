#!/usr/bin/env bash
# RNOS-M3 — Start local stack + capture store screenshots
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
export PORTAL_E2E_APPROVER_EMAIL="${PORTAL_E2E_APPROVER_EMAIL:-approver@demo.local}"
export PORTAL_E2E_APPROVER_PASSWORD="${PORTAL_E2E_APPROVER_PASSWORD:-demo123}"
export PORTAL_E2E_SKIP_SERVER=1

API_PID=""
PORTAL_PID=""

_wait_http() {
  local url="$1" label="$2" tries="${3:-90}"
  for _ in $(seq 1 "$tries"); do
    if curl -sf "$url" >/dev/null 2>&1; then
      echo "OK  $label"
      return 0
    fi
    sleep 1
  done
  echo "FAIL $label — $url" >&2
  return 1
}

cleanup() {
  [[ -n "$API_PID" ]] && kill "$API_PID" 2>/dev/null || true
  [[ -n "$PORTAL_PID" ]] && kill "$PORTAL_PID" 2>/dev/null || true
}
trap cleanup EXIT

echo "== RNOS-M3 store screenshots (local E2E stack) =="

lsof -ti :3000 2>/dev/null | xargs kill 2>/dev/null || true
lsof -ti :3100 2>/dev/null | xargs kill 2>/dev/null || true
sleep 1

echo "==> Start ptt-crm-api stub"
(
  cd "$ROOT/services/ptt-crm-api"
  [[ -d node_modules ]] || npm ci
  npm run build
  export DATABASE_URL="${DATABASE_URL:-postgresql://ptt:ptt_dev@127.0.0.1:5433/rnosaidb}"
  export NODE_ENV=development PORT=3000
  export PTT_PORTAL_ALLOW_STUB=1
  export PTT_PORTAL_STUB_USERS="${PORTAL_E2E_APPROVER_EMAIL}:${PORTAL_E2E_APPROVER_PASSWORD}:550e8400-e29b-41d4-a716-446655440000:approver"
  export PTT_PORTAL_JWT_SECRET="${PTT_PORTAL_JWT_SECRET:-rnos-m2-e2e-portal-jwt-secret-min-32-chars}"
  export PTT_CRM_INTERNAL_KEY="${PTT_CRM_INTERNAL_KEY:-rnos-m2-e2e-internal-key}"
  export PTT_PORTAL_CORS_ORIGINS="http://127.0.0.1:3100,http://localhost:3100"
  npm run start:prod
) >/tmp/rnos-m3-screenshot-api.log 2>&1 &
API_PID=$!
_wait_http "${PORTAL_E2E_API_URL}/health" "Nest API"

if ! curl -sf -X POST "${PORTAL_E2E_API_URL}/api/v1/portal/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"${PORTAL_E2E_APPROVER_EMAIL}\",\"password\":\"${PORTAL_E2E_APPROVER_PASSWORD}\"}" \
  | grep -q 'access_token'; then
  echo "FAIL stub login — see /tmp/rnos-m3-screenshot-api.log" >&2
  tail -20 /tmp/rnos-m3-screenshot-api.log >&2 || true
  exit 1
fi
echo "OK  stub approver login"

echo "==> Start portal-web"
(
  cd "$ROOT/services/portal-web"
  export PORTAL_PORT=3100
  export NEXT_PUBLIC_PTT_API_URL="$PORTAL_E2E_API_URL"
  export NEXT_PUBLIC_PWA_ENABLED=1
  npm run dev
) >/tmp/rnos-m3-screenshot-portal.log 2>&1 &
PORTAL_PID=$!
_wait_http "${PORTAL_E2E_URL}/manifest.webmanifest" "portal-web"
sleep 3

bash "$ROOT/scripts/m3_store_screenshots_capture.sh"
