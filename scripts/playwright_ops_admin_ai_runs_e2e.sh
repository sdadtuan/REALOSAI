#!/usr/bin/env bash
# UI-R1-09 — Playwright admin AI runs smoke
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

ENV_FILE="${UI_R1_09_ENV:-$ROOT/deploy/env.local.example}"
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
  LOGIN_JSON="$(curl -sf -X POST "${OPS_E2E_API_URL}/api/v1/staff/auth/login" \
    -H 'Content-Type: application/json' \
    -d "{\"email\":\"${OPS_E2E_STAFF_EMAIL}\",\"password\":\"${OPS_E2E_STAFF_PASSWORD}\"}" 2>/dev/null || true)"
  TOKEN="$(python3 - <<PY
import json, sys
try:
  data = json.loads("""${LOGIN_JSON:-{}}""")
  print(data.get("access_token") or "")
except Exception:
  print("")
PY
)"
  if [[ -z "$TOKEN" ]]; then
    NEED_API_START=1
  else
    RUNS_CODE="$(curl -s -o /dev/null -w '%{http_code}' \
      -H "Authorization: Bearer ${TOKEN}" \
      "${OPS_E2E_API_URL}/api/v1/ai/runs?limit=5" || echo 000)"
    if [[ "$RUNS_CODE" != "200" && "$RUNS_CODE" != "503" ]]; then
      echo "WARN  ai/runs returned HTTP $RUNS_CODE — restarting Nest API"
      NEED_API_START=1
    else
      NEED_API_START=0
      echo "OK  Nest API already running (ai/runs HTTP $RUNS_CODE)"
    fi
  fi
fi

if [[ "${NEED_API_START:-0}" == "1" ]]; then
  lsof -ti:3000 | xargs kill 2>/dev/null || true
  sleep 1
  echo "==> Start ptt-crm-api for UI-R1-09 E2E"
  (
    cd "$ROOT/services/ptt-crm-api"
    if [[ ! -d node_modules ]]; then npm ci; fi
    npm run build
    export DATABASE_URL="${DATABASE_URL:-postgresql://ptt:ptt_dev@127.0.0.1:5433/rnosaidb}"
    export PTT_SQLITE_PATH="${PTT_SQLITE_PATH:-$ROOT/ptt.db}"
    export NODE_ENV=development PORT=3000
    export PTT_STAFF_ALLOW_STUB=1
    export PTT_STAFF_STUB_USERS="${OPS_E2E_STAFF_EMAIL}:${OPS_E2E_STAFF_PASSWORD}:1:1:E2E UI-R1-09"
    export PTT_STAFF_JWT_SECRET="${PTT_STAFF_JWT_SECRET:-ui-r1-09-e2e-staff-jwt-secret-min-32-chars}"
    npm run start:prod
  ) >/tmp/ui-r1-09-api.log 2>&1 &
  API_PID=$!
  _wait_http "${OPS_E2E_API_URL}/api/v1/ai/health" "Nest API" 120
fi

echo "==> Playwright UI-R1-09 admin AI runs"
(
  cd "$ROOT/services/ops-web"
  if [[ ! -d node_modules ]]; then npm ci; fi
  npm run test:e2e:admin-ai-runs
)
