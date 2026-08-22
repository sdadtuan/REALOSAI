#!/usr/bin/env bash
# RNOS-39 — Playwright E2E AI Copilot (Nest + ops-web)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PYTHON="${PYTHON:-python3}"
if [[ -x "$ROOT/.venv/bin/python" ]]; then
  PYTHON="$ROOT/.venv/bin/python"
fi
export PYTHONPATH="$ROOT${PYTHONPATH:+:$PYTHONPATH}"

ENV_FILE="${RNOS39_ENV:-$ROOT/deploy/env.local.example}"
if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE" 2>/dev/null || true
  set +a
fi

export OPS_E2E_URL="${OPS_E2E_URL:-http://127.0.0.1:3200}"
export OPS_E2E_API_URL="${OPS_E2E_API_URL:-http://127.0.0.1:3000}"
export OPS_E2E_SKIP_SERVER="${OPS_E2E_SKIP_SERVER:-0}"
export OPS_E2E_STAFF_EMAIL="${OPS_E2E_STAFF_EMAIL:-staff@demo.local}"
export OPS_E2E_STAFF_PASSWORD="${OPS_E2E_STAFF_PASSWORD:-demo12345}"
export OPS_E2E_AI_LEAD_ID="${OPS_E2E_AI_LEAD_ID:-9000050}"
export NEXT_PUBLIC_PTT_API_URL="${NEXT_PUBLIC_PTT_API_URL:-$OPS_E2E_API_URL}"
export NEXT_PUBLIC_PTT_AI_COPILOT_ENABLED="${NEXT_PUBLIC_PTT_AI_COPILOT_ENABLED:-1}"
export OPS_E2E_USE_DEV="${OPS_E2E_USE_DEV:-1}"

export PTT_ARTIFACTS_DIR="${PTT_ARTIFACTS_DIR:-$ROOT/.local-dev}"

API_PID=""
WEB_PID=""

_wait_http() {
  local url="$1" label="$2" tries="${3:-40}"
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
  [[ -n "$WEB_PID" ]] && kill "$WEB_PID" 2>/dev/null || true
}
trap cleanup EXIT

_ensure_sqlite_e2e_lead() {
  local lead_id="${OPS_E2E_AI_LEAD_ID:-9000050}"
  local sqlite="${PTT_SQLITE_PATH:-$ROOT/ptt.db}"
  [[ -f "$sqlite" ]] || return 0
  sqlite3 "$sqlite" <<SQL
INSERT OR IGNORE INTO crm_leads (
  id, full_name, phone, phone_norm, email, email_norm, source, status,
  owner_id, created_at, updated_at, created_by, updated_by
) VALUES (
  ${lead_id},
  'Gate Sample ${lead_id}',
  '0900000050',
  '0900000050',
  'gate${lead_id}@example.invalid',
  'gate${lead_id}@example.invalid',
  'meta',
  'new',
  1,
  datetime('now'),
  datetime('now'),
  'rnos39-e2e',
  'rnos39-e2e'
);
UPDATE crm_leads SET owner_id = 1 WHERE id = ${lead_id};
SQL
}

if [[ "${RNOS39_SKIP_BOOTSTRAP:-0}" != "1" ]]; then
  bash "$ROOT/scripts/rnos39_e2e_bootstrap.sh"
fi

echo "==> Build Nest API"
(
  cd "$ROOT/services/ptt-crm-api"
  if [[ ! -d node_modules ]]; then npm ci; fi
  npm run build
)

if ! curl -sf "${OPS_E2E_API_URL}/api/v1/ai/health" >/dev/null 2>&1; then
  echo "==> Start ptt-crm-api"
  (
    cd "$ROOT/services/ptt-crm-api"
    export DATABASE_URL="${DATABASE_URL:?DATABASE_URL required}"
    export PTT_LEADS_READ_SOURCE="${PTT_LEADS_READ_SOURCE:-pg}"
    export PTT_SQLITE_PATH="${PTT_SQLITE_PATH:-$ROOT/ptt.db}"
    export NODE_ENV=development PORT=3000
    export PTT_AI_COPILOT_ENABLED=1
    export PTT_STAFF_ALLOW_STUB=1
    export PTT_STAFF_STUB_USERS="${OPS_E2E_STAFF_EMAIL}:${OPS_E2E_STAFF_PASSWORD}:1:1:E2E Pilot"
    export PTT_CRM_INTERNAL_KEY="${PTT_CRM_INTERNAL_KEY:-rnos39-e2e-internal-key}"
    export PTT_STAFF_JWT_SECRET="${PTT_STAFF_JWT_SECRET:-rnos39-e2e-staff-jwt-secret-min-32-chars}"
    npm run start:prod >/tmp/rnos39-api.log 2>&1
  ) &
  API_PID=$!
  _wait_http "${OPS_E2E_API_URL}/api/v1/ai/health" "Nest AI health"
else
  echo "OK  Nest API already running"
fi

if [[ -n "${DATABASE_URL:-}" ]]; then
  echo "==> Ensure lead ${OPS_E2E_AI_LEAD_ID} owner_id=1 for stub staff"
  psql "$DATABASE_URL" -q -c \
    "UPDATE crm_leads SET owner_id = 1 WHERE sqlite_lead_id = ${OPS_E2E_AI_LEAD_ID};" 2>/dev/null || true
fi

_ensure_sqlite_e2e_lead

if [[ "${OPS_E2E_SKIP_SERVER:-0}" != "1" ]]; then
  if ! curl -sf "${OPS_E2E_URL}/login" >/dev/null 2>&1; then
    echo "==> Start ops-web (next dev on ${OPS_E2E_URL})"
    (
      cd "$ROOT/services/ops-web"
      export OPS_PORT="${OPS_PORT:-$(node -e "console.log(new URL(process.argv[1]).port||3200)" "$OPS_E2E_URL")}"
      export NEXT_PUBLIC_PTT_API_URL="$OPS_E2E_API_URL"
      export NEXT_PUBLIC_PTT_AI_COPILOT_ENABLED=1
      if [[ "$OPS_E2E_USE_DEV" == "0" ]]; then
        NODE_ENV=production npm run start
      else
        npm run dev
      fi
    ) >/tmp/rnos39-ops-web.log 2>&1 &
    WEB_PID=$!
    _wait_http "${OPS_E2E_URL}/login" "ops-web login" 120
  else
    echo "OK  ops-web already running"
  fi
  export OPS_E2E_SKIP_SERVER=1
fi

echo "==> Prepare ops-web (Playwright reuse server; OPS_E2E_USE_DEV=${OPS_E2E_USE_DEV})"
(
  cd "$ROOT/services/ops-web"
  if [[ ! -d node_modules ]]; then npm ci; fi
)
if [[ "$OPS_E2E_USE_DEV" == "0" ]]; then
  echo "==> Production build ops-web (OPS_E2E_USE_DEV=0)"
  (
    cd "$ROOT/services/ops-web"
    export NEXT_PUBLIC_PTT_API_URL="$OPS_E2E_API_URL"
    export NEXT_PUBLIC_PTT_AI_COPILOT_ENABLED=1
    NODE_ENV=production npm run build
  )
fi

echo "==> Playwright ai-copilot.spec.ts"
cd "$ROOT/services/ops-web"
if [[ ! -d node_modules/@playwright/test ]]; then
  npm install
fi
if [[ ! -d ~/.cache/ms-playwright ]] && [[ ! -d node_modules/playwright/.local-browsers ]]; then
  npx playwright install chromium
fi

npm run test:e2e:ai-copilot

REPORT="$PTT_ARTIFACTS_DIR/rnos39-e2e-report.json"
mkdir -p "$(dirname "$REPORT")"
"$PYTHON" - <<PY
import json
import os
from datetime import datetime, timezone
from pathlib import Path

report = {
    "ok": True,
    "rnos": "RNOS-39",
    "generated_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
    "playwright_spec": "services/ops-web/e2e/ai-copilot.spec.ts",
    "lead_id": os.environ.get("OPS_E2E_AI_LEAD_ID", ""),
    "ops_url": os.environ.get("OPS_E2E_URL", ""),
    "api_url": os.environ.get("OPS_E2E_API_URL", ""),
    "notes": "Pilot 8-step UAT + BR-AI-01 — see services/ops-web/e2e/README.md",
}
Path("${REPORT}").write_text(json.dumps(report, indent=2) + "\\n", encoding="utf-8")
print(json.dumps(report, indent=2))
PY

echo "OK  RNOS-39 Playwright E2E — $REPORT"
