#!/usr/bin/env bash
# S-LMP-1 gate — DDL + enqueue + worker stub result
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -f "$ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env"
  set +a
fi

: "${DATABASE_URL:?DATABASE_URL required}"
: "${PTT_CRM_INTERNAL_KEY:?PTT_CRM_INTERNAL_KEY required}"

PYTHON="${PYTHON:-python3}"
if [[ -x "$ROOT/.venv/bin/python" ]]; then
  PYTHON="$ROOT/.venv/bin/python"
elif [[ -x "/var/www/ptt/.venv/bin/python" ]]; then
  PYTHON="/var/www/ptt/.venv/bin/python"
fi
export PYTHONPATH="$ROOT${PYTHONPATH:+:$PYTHONPATH}"

ensure_pytest() {
  if "$PYTHON" -m pytest --version >/dev/null 2>&1; then
    return 0
  fi
  echo "== install pytest for LMP gate =="
  "$PYTHON" -m pip install -q pytest
}

PTT_API_URL="${PTT_API_URL:-http://127.0.0.1:3000}"

pass=0
fail=0
ok() { pass=$((pass + 1)); echo "PASS  $1"; }
bad() { fail=$((fail + 1)); echo "FAIL  $1"; }

echo "== LMP S-LMP-2 gate =="

bash "$ROOT/scripts/apply_pg_ddl_lead_meeting_prep.sh"
ok "DDL applied"

TABLE=$(psql "$DATABASE_URL" -tAc "SELECT COUNT(*) FROM information_schema.tables WHERE table_name='crm_lead_meeting_prep'")
[[ "$TABLE" == "1" ]] && ok "crm_lead_meeting_prep exists" || bad "table missing"

ensure_pytest
"$PYTHON" -m pytest "$ROOT/tests/test_lmp_input_resolver.py" -q && ok "python input resolver tests" || bad "python input resolver tests"
"$PYTHON" -m pytest "$ROOT/tests/test_lmp_verify.py" -q && ok "python verify tests" || bad "python verify tests"
"$PYTHON" -m pytest "$ROOT/tests/test_lmp_schema.py" -q && ok "python schema tests" || bad "python schema tests"

if [[ -d "$ROOT/services/ptt-crm-api/node_modules" ]]; then
  (cd "$ROOT/services/ptt-crm-api" && npm test -- --testPathPattern="lead-meeting-prep" --passWithNoTests 2>/dev/null) \
    && ok "nest LMP specs" || bad "nest LMP specs"
else
  echo "SKIP  nest spec (npm install in ptt-crm-api)"
fi

# Worker pipeline unit (no PG job / Tavily required)
"$PYTHON" - <<'PY' && ok "synthesize stub shape"
from ptt_crm.lead_meeting_prep.synthesize import build_stub_llm_result
from ptt_crm.lead_meeting_prep.collect import collect_company
from ptt_crm.lead_meeting_prep import close_intelligence
inp = {"lead_id": 1, "company_name": "Cty Gate", "industry": "BDS", "problem": "Can lead", "phone": "0901234567"}
collect = collect_company(inp)
result = build_stub_llm_result(inp, collect, verify_website=None, prep_stage="m1_first_strike")
close_intelligence.enrich_close_intelligence(result, inp, collect, prep_stage="m1_first_strike")
assert result["contact_profile"]["found"] is False
assert 1 <= len(result["recommended_services"]) <= 3
sci = result["close_intelligence"]
assert len(sci["offer_ladder"]) == 3
assert len(sci["talk_track"]["phases"]) >= 3
PY

if [[ "${LMP_E2E:-0}" == "1" ]]; then
  echo "== LMP E2E (requires worker + PTT_LEAD_MEETING_PREP_ENABLED=1) =="
  : "${TAVILY_API_KEY:?TAVILY_API_KEY required for LMP_E2E}"
  ADMIN_EMAIL="${OPS_E2E_STAFF_EMAIL:-admin@pttads.vn}"
  ADMIN_PASSWORD="${OPS_E2E_STAFF_PASSWORD:-${ADMIN_PASSWORD:-}}"
  if [[ -z "${STAFF_TOKEN:-}" && -n "${ADMIN_PASSWORD:-}" ]]; then
    STAFF_TOKEN="$(curl -sf -X POST "$PTT_API_URL/api/crm/staff/login" \
      -H 'Content-Type: application/json' \
      -d "{\"email\":\"${ADMIN_EMAIL}\",\"password\":\"${ADMIN_PASSWORD}\"}" \
      | python3 -pe 'import json,sys; print(json.load(sys.stdin).get("access_token",""))')"
    export STAFF_TOKEN
  fi
  if [[ -z "${STAFF_TOKEN:-}" ]]; then
    bad "LMP_E2E needs STAFF_TOKEN or ADMIN_PASSWORD"
  else
    FIXTURE_PHONE="090$(python3 - <<'PY'
import random
print(f"{random.randint(1000000,9999999):07d}")
PY
)"
    CREATE=$(curl -sf -X POST "$PTT_API_URL/api/v1/leads" \
      -H "Authorization: Bearer ${STAFF_TOKEN}" \
      -H 'Content-Type: application/json' \
      -d "{\"full_name\":\"LMP Gate Co\",\"phone\":\"${FIXTURE_PHONE}\",\"channel\":\"manual\",\"source\":\"lmp_gate\"}")
    LEAD_ID=$(python3 -pe 'import json,sys; print(json.loads(sys.argv[1])["id"])' "$CREATE")
    psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c \
      "UPDATE crm_leads SET meta_json = COALESCE(meta_json,'{}'::jsonb) || '{\"company_name\":\"Cty LMP Gate Test\",\"industry\":\"BDS\",\"problem\":\"Can lead Meta\"}'::jsonb WHERE sqlite_lead_id = ${LEAD_ID};"
    curl -sf -X POST "$PTT_API_URL/api/v1/leads/${LEAD_ID}/meeting-prep/run" \
      -H "Authorization: Bearer ${STAFF_TOKEN}" \
      -H 'Content-Type: application/json' \
      -d '{"force":true}' >/dev/null
    deadline=$((SECONDS + 360))
    status=""
    while [[ $SECONDS -lt $deadline ]]; do
      PREP=$(curl -sf "$PTT_API_URL/api/v1/leads/${LEAD_ID}/meeting-prep" -H "Authorization: Bearer ${STAFF_TOKEN}")
      status=$(python3 -pe 'import json,sys; print(json.loads(sys.argv[1]).get("status",""))' "$PREP")
      [[ "$status" == "ready" || "$status" == "failed" || "$status" == "awaiting_entity_choice" ]] && break
      sleep 5
    done
    PREP_FILE="$(mktemp)"
    trap 'rm -f "$PREP_FILE"' EXIT
    printf '%s' "$PREP" > "$PREP_FILE"
    python3 - <<PY && ok "LMP E2E prep ready"
import json, sys
with open("$PREP_FILE") as f:
    prep = json.load(f)
assert prep.get("status") == "ready", prep.get("status")
result = prep.get("result") or {}
assert result.get("contact_profile", {}).get("found") is False
svcs = result.get("recommended_services") or []
assert 1 <= len(svcs) <= 3
PY
    RUNS=$(psql "$DATABASE_URL" -tAc "SELECT COUNT(*) FROM ai_agent_runs WHERE use_case='lead_meeting_prep' AND input_json->>'lead_id'='${LEAD_ID}'")
    [[ "${RUNS:-0}" -ge 1 ]] && ok "ai_agent_runs logged" || bad "ai_agent_runs missing"
  fi
fi

if [[ "$fail" -eq 0 ]]; then
  echo "PASS lead_meeting_prep_gate ($pass checks)"
  exit 0
fi
echo "FAIL lead_meeting_prep_gate ($fail failures)"
exit 1
