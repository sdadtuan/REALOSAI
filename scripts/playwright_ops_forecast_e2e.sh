#!/usr/bin/env bash
# RNOS-17/18 — Playwright forecast smoke
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export OPS_E2E_URL="${OPS_E2E_URL:-http://127.0.0.1:3200}"
export OPS_E2E_API_URL="${OPS_E2E_API_URL:-http://127.0.0.1:3000}"
export OPS_E2E_SKIP_SERVER="${OPS_E2E_SKIP_SERVER:-0}"
export OPS_E2E_USE_DEV="${OPS_E2E_USE_DEV:-1}"
export NEXT_PUBLIC_PTT_API_URL="${NEXT_PUBLIC_PTT_API_URL:-$OPS_E2E_API_URL}"

API_PID=""
cleanup() { [[ -n "$API_PID" ]] && kill "$API_PID" 2>/dev/null || true; }
trap cleanup EXIT

if ! curl -sf "${OPS_E2E_API_URL}/api/v1/ai/health" >/dev/null 2>&1; then
  lsof -ti:3000 | xargs kill 2>/dev/null || true
  sleep 1
  (
    cd "$ROOT/services/ptt-crm-api"
    npm run build
    export DATABASE_URL="${DATABASE_URL:-postgresql://ptt:ptt_dev@127.0.0.1:5433/rnosaidb}"
    export PTT_SQLITE_PATH="${PTT_SQLITE_PATH:-$ROOT/ptt.db}"
    export NODE_ENV=development PORT=3000
    export PTT_STAFF_ALLOW_STUB=1
    export PTT_STAFF_STUB_USERS="${OPS_E2E_STAFF_EMAIL:-staff@demo.local}:${OPS_E2E_STAFF_PASSWORD:-demo12345}:1:1:E2E RNOS-17"
    export PTT_STAFF_JWT_SECRET="${PTT_STAFF_JWT_SECRET:-rnos17-e2e-staff-jwt-secret-min-32-chars}"
    npm run start:prod
  ) >/tmp/rnos17-api.log 2>&1 &
  API_PID=$!
  for _ in $(seq 1 120); do
    curl -sf "${OPS_E2E_API_URL}/api/v1/ai/health" >/dev/null 2>&1 && break
    sleep 1
  done
fi

(
  cd "$ROOT/services/ops-web"
  npm run test:e2e:forecast
)
