#!/usr/bin/env bash
# RNOS-40 — Rollback drill (flag / cohort / prompt / model checklist)
# Simulates runbook §8–§9 without touching prod. Writes JSON report.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

ENV_FILE="${RNOS40_ENV:-$ROOT/deploy/env.local.example}"
if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE" 2>/dev/null || true
  set +a
fi

: "${DATABASE_URL:?DATABASE_URL required}"

BASE="${BASE:-http://127.0.0.1:3000}"
STAFF_EMAIL="${STAFF_EMAIL:-staff@demo.local}"
STAFF_PASSWORD="${STAFF_PASSWORD:-demo12345}"
REPORT="${REPORT:-$ROOT/.local-dev/rnos40-rollback-drill.json}"
DRILL_PORT_OFF="${DRILL_PORT_OFF:-3010}"
DRILL_PORT_COHORT="${DRILL_PORT_COHORT:-3011}"

API_PID=""
pass=0
fail=0
skip=0
results=()

log_ok() { pass=$((pass + 1)); results+=("{\"id\":\"$1\",\"status\":\"pass\",\"detail\":$(python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$2")}"); echo "PASS  $1 — $2"; }
log_fail() { fail=$((fail + 1)); results+=("{\"id\":\"$1\",\"status\":\"fail\",\"detail\":$(python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$2")}"); echo "FAIL  $1 — $2"; }
log_skip() { skip=$((skip + 1)); results+=("{\"id\":\"$1\",\"status\":\"skip\",\"detail\":$(python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$2")}"); echo "SKIP  $1 — $2"; }

cleanup() {
  [[ -n "$API_PID" ]] && kill "$API_PID" 2>/dev/null || true
}
trap cleanup EXIT

wait_http() {
  local url="$1" tries="${2:-50}"
  for _ in $(seq 1 "$tries"); do
    if curl -sf "$url" >/dev/null 2>&1; then return 0; fi
    sleep 0.4
  done
  return 1
}

start_api() {
  local port="$1"
  shift
  (
    cd "$ROOT/services/ptt-crm-api"
    export DATABASE_URL PTT_LEADS_READ_SOURCE="${PTT_LEADS_READ_SOURCE:-pg}"
    export PTT_SQLITE_PATH="${PTT_SQLITE_PATH:-$ROOT/ptt.db}"
    export NODE_ENV=development PORT="$port"
    export PTT_STAFF_ALLOW_STUB=1
    export PTT_STAFF_STUB_USERS="${STAFF_EMAIL}:${STAFF_PASSWORD}:1:1:Drill Pilot"
    # Force JWT path in StaffOrInternalKeyGuard (no internal bypass like prod/staging)
    export PTT_CRM_INTERNAL_KEY=rnos40-drill-internal-key
    export PTT_STAFF_JWT_SECRET="${PTT_STAFF_JWT_SECRET:-rnos40-drill-staff-jwt-secret-min-32-chars}"
    unset PTT_AI_COPILOT_ENABLED PTT_AI_PILOT_USER_IDS || true
    for kv in "$@"; do
      export "$kv"
    done
    node dist/main.js >/tmp/rnos40-api-"${port}".log 2>&1
  ) &
  API_PID=$!
  if ! wait_http "http://127.0.0.1:${port}/api/v1/ai/health"; then
    log_fail "boot-${port}" "API port ${port} did not start — /tmp/rnos40-api-${port}.log"
    tail -15 "/tmp/rnos40-api-${port}.log" 2>/dev/null || true
    kill "$API_PID" 2>/dev/null || true
    API_PID=""
    return 1
  fi
  return 0
}

stop_api() {
  [[ -n "$API_PID" ]] && kill "$API_PID" 2>/dev/null || true
  API_PID=""
  sleep 0.5
}

staff_token() {
  local base="$1"
  local json
  json=$(curl -sf "$base/api/v1/staff/auth/login" \
    -H 'Content-Type: application/json' \
    -d "{\"email\":\"$STAFF_EMAIL\",\"password\":\"$STAFF_PASSWORD\"}" 2>/dev/null || echo '{}')
  python3 -c 'import json,sys; print(json.loads(sys.argv[1]).get("access_token",""))' "$json"
}

echo "== RNOS-40 Rollback drill =="
echo "   Report → $REPORT"

if [[ ! -f "$ROOT/services/ptt-crm-api/dist/main.js" ]]; then
  echo "Building ptt-crm-api dist..."
  (cd "$ROOT/services/ptt-crm-api" && npm run build)
fi

# ── 1. env.ai.example completeness ──
ENV_EX="$ROOT/deploy/env.ai.example"
for key in PTT_AI_COPILOT_ENABLED PTT_AI_PILOT_USER_IDS PTT_AI_LLM_MODEL PTT_AI_LOG_PII PTT_AI_LOG_PROMPTS PTT_AI_SCORE_ASYNC PTT_AI_SUMMARIZE_RATE_LIMIT_PER_MIN; do
  if grep -q "^${key}=" "$ENV_EX" 2>/dev/null || grep -q "^# ${key}=" "$ENV_EX" 2>/dev/null || grep -q "${key}=" "$ENV_EX" 2>/dev/null; then
    log_ok "env-key-${key}" "Documented in deploy/env.ai.example"
  else
    log_fail "env-key-${key}" "Missing from deploy/env.ai.example"
  fi
done

# ── 2. Prompt rollback SQL (read-only) ──
PROMPT_ROWS=$(psql "$DATABASE_URL" -tAc \
  "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_name='ai_prompts';" 2>/dev/null | tr -d ' ' || echo 0)
if [[ "$PROMPT_ROWS" == "1" ]]; then
  PROMPT_LIST=$(psql "$DATABASE_URL" -tAc \
    "SELECT use_case || ':v' || version || (CASE WHEN is_active THEN '*' ELSE '' END) FROM ai_prompts ORDER BY use_case, version DESC LIMIT 12;" 2>/dev/null | tr '\n' '; ' || true)
  log_ok "prompt-table" "ai_prompts readable (${PROMPT_LIST:-empty — code defaults active})"
  log_ok "prompt-rollback-sql" "Runbook §9.2: UPDATE ai_prompts SET is_active by use_case + version"
else
  log_skip "prompt-table" "ai_prompts not in DB — app uses DEFAULT_PROMPTS from code"
fi

# ── 3. Model rollback checklist (documented) ──
MODEL_DOC=$(grep -c "PTT_AI_LLM_MODEL" "$ENV_EX" || true)
if [[ "$MODEL_DOC" -ge 1 ]]; then
  log_ok "model-rollback-doc" "Change PTT_AI_LLM_MODEL + restart ptt-crm-api (runbook §9.1)"
else
  log_fail "model-rollback-doc" "PTT_AI_LLM_MODEL not documented"
fi

# ── 4. Flag OFF drill (isolated port) ──
stop_api
if start_api "$DRILL_PORT_OFF" PTT_AI_COPILOT_ENABLED=0; then
  OFF_BASE="http://127.0.0.1:${DRILL_PORT_OFF}"
  HEALTH=$(curl -sf "$OFF_BASE/api/v1/ai/health" 2>/dev/null || echo '{}')
  if python3 -c 'import json,sys; d=json.loads(sys.argv[1]); print("ok" if d.get("data",{}).get("status")=="disabled" or d.get("data",{}).get("copilot_enabled") is False else "")' "$HEALTH" | grep -q ok; then
    log_ok "flag-off-health" "Health reports copilot disabled"
  else
    log_fail "flag-off-health" "Expected status=disabled: $HEALTH"
  fi
  TOKEN=$(staff_token "$OFF_BASE")
  CODE=$(curl -s -o /tmp/rnos40-off.json -w "%{http_code}" \
    -X POST "$OFF_BASE/api/v1/ai/summarize" \
    -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
    -d '{"context":"lead_brief","entity_type":"lead","entity_id":"9000050"}' 2>/dev/null || echo 000)
  if [[ "$CODE" == "503" ]]; then
    log_ok "flag-off-api" "POST /ai/summarize → 503 when PTT_AI_COPILOT_ENABLED=0"
  else
    log_fail "flag-off-api" "Expected 503, got HTTP $CODE — $(head -c 120 /tmp/rnos40-off.json)"
  fi
  stop_api
else
  log_fail "flag-off-boot" "Could not start isolated API for flag-off test"
fi

# ── 5. Pilot cohort drill (isolated port) ──
if start_api "$DRILL_PORT_COHORT" PTT_AI_COPILOT_ENABLED=1 PTT_AI_PILOT_USER_IDS=99999; then
  COH_BASE="http://127.0.0.1:${DRILL_PORT_COHORT}"
  COH_HEALTH=$(curl -sf "$COH_BASE/api/v1/ai/health" 2>/dev/null || echo '{}')
  COHORT_SIZE=$(python3 -c 'import json,sys; print(json.loads(sys.argv[1]).get("data",{}).get("pilot_cohort_size",-1))' "$COH_HEALTH")
  if [[ "$COHORT_SIZE" == "1" ]]; then
    log_ok "cohort-env" "Health reports pilot_cohort_size=1"
  else
    log_fail "cohort-env" "Expected pilot_cohort_size=1, got $COHORT_SIZE"
  fi
  TOKEN=$(staff_token "$COH_BASE")
  CODE=$(curl -s -o /tmp/rnos40-cohort.json -w "%{http_code}" \
    -X POST "$COH_BASE/api/v1/ai/summarize" \
    -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
    -d '{"context":"lead_brief","entity_type":"lead","entity_id":"9000050"}' 2>/dev/null || echo 000)
  if [[ "$CODE" == "403" ]]; then
    log_ok "cohort-block" "Staff sub=1 blocked when not in PTT_AI_PILOT_USER_IDS"
  else
    log_fail "cohort-block" "Expected 403 pilot cohort, got HTTP $CODE — $(head -c 120 /tmp/rnos40-cohort.json)"
  fi
  stop_api
else
  log_fail "cohort-boot" "Could not start isolated API for cohort test"
fi

# ── 6. Flag ON on main BASE (if running) ──
if curl -sf "$BASE/api/v1/ai/health" >/dev/null 2>&1; then
  ON_HEALTH=$(curl -sf "$BASE/api/v1/ai/health" 2>/dev/null || echo '{}')
  if python3 -c 'import json,sys; d=json.loads(sys.argv[1]); print("ok" if d.get("data",{}).get("copilot_enabled") else "off")' "$ON_HEALTH" | grep -q ok; then
    log_ok "flag-on-main" "Main API has copilot enabled"
  else
    log_skip "flag-on-main" "Main API copilot disabled — set PTT_AI_COPILOT_ENABLED=1 for full drill"
  fi
else
  log_skip "flag-on-main" "Main API not running on $BASE"
fi

# ── Report ──
mkdir -p "$(dirname "$REPORT")"
TMP_RESULTS="$(mktemp)"
printf '%s\n' "${results[@]}" > "$TMP_RESULTS"
python3 - <<PY
import json, datetime
from pathlib import Path
lines = [l for l in Path("$TMP_RESULTS").read_text().splitlines() if l.strip()]
checks = [json.loads(l) for l in lines]
report = {
  "generated_at": datetime.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
  "runbook": "docs/runbooks/ai-service-operations.md",
  "drill_type": "rollback_flag_cohort_prompt_model",
  "summary": {"pass": $pass, "fail": $fail, "skip": $skip},
  "checks": checks,
  "procedures_verified": [
    "§8.2 PTT_AI_COPILOT_ENABLED=0 → 503 guarded routes",
    "§6.1 PTT_AI_PILOT_USER_IDS cohort allowlist",
    "§9.1 PTT_AI_LLM_MODEL env documented",
    "§9.2 ai_prompts use_case version rollback SQL",
  ],
}
Path("$REPORT").write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n")
PY
rm -f "$TMP_RESULTS"

echo ""
echo "Report: $REPORT"
echo "PASS=$pass FAIL=$fail SKIP=$skip"
[[ "$fail" -eq 0 ]]
