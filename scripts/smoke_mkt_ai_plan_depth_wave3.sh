#!/usr/bin/env bash
# WS-P4-09 — Plan depth Wave 3: KPI closed-loop, weekly memo, competitor snapshot (MKTP-UC-028)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ -f "$ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env"
  set +a
fi

API_URL="${PTT_API_URL:-http://127.0.0.1:3000}"
LIFECYCLE_ID="${LIFECYCLE_ID:-1}"
KEY="${PTT_CRM_INTERNAL_KEY:-}"
EMAIL="${ADMIN_EMAIL:-${OPS_E2E_STAFF_EMAIL:-admin@pttads.vn}}"
PASS="${ADMIN_PASSWORD:-${OPS_E2E_STAFF_PASSWORD:-}}"

AUTH=()
if [[ -n "$KEY" ]]; then
  AUTH=(-H "x-ptt-internal-key: $KEY")
elif [[ -n "$PASS" ]]; then
  TOKEN="$(
    curl -sf "$API_URL/api/v1/staff/auth/login" \
      -H 'Content-Type: application/json' \
      -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}" \
    | python3 -c "import sys,json; print(json.load(sys.stdin).get('access_token',''))" 2>/dev/null || true
  )"
  [[ -n "$TOKEN" ]] && AUTH=(-H "Authorization: Bearer $TOKEN")
fi

if [[ ${#AUTH[@]} -eq 0 ]]; then
  echo "FAIL: set PTT_CRM_INTERNAL_KEY or ADMIN_PASSWORD for smoke auth"
  exit 1
fi

auth=("${AUTH[@]}" -H "Content-Type: application/json")
base="$API_URL/api/crm/service-lifecycle/$LIFECYCLE_ID/ai-planner"
admin_base="$API_URL/api/crm/mkt-ai-planner"

echo "== smoke_mkt_ai_plan_depth_wave3 =="
echo "lifecycle=$LIFECYCLE_ID api=$API_URL"

ctx="$(curl -sf "${auth[@]}" "$base/context")"
echo "$ctx" | grep -q '"enabled":true' || { echo "FAIL: planner disabled"; exit 1; }

echo "$ctx" | grep -q '"kpi_closed_loop_enabled":true' || {
  echo "FAIL: PTT_MKT_AI_KPI_CLOSED_LOOP not enabled"
  exit 1;
}

# D1 — KPI closed-loop endpoint
loop="$(curl -sf "${auth[@]}" "$base/kpi-closed-loop?weeks=6&channel=meta")"
echo "$loop" | grep -q '"enabled":true' || { echo "FAIL kpi-closed-loop shape"; exit 1; }
echo "$loop" | grep -q '"rows"' && echo "OK kpi-closed-loop rows" || { echo "FAIL kpi-closed-loop rows"; exit 1; }

# Seed applied KPI tree for closed-loop (smoke-only)
curl -sf "${auth[@]}" -X PATCH "$base/draft" -d '{
  "kpi_tree_json": [{
    "id": "north_star",
    "label": "CPL",
    "target": "< 500k",
    "unit": "VND",
    "children": [{"id": "c1", "label": "Meta Lead", "target": "100 leads"}]
  }],
  "kpi_tree_applied_json": [{
    "id": "north_star",
    "label": "CPL",
    "target": "< 500k",
    "unit": "VND",
    "children": [{"id": "c1", "label": "Meta Lead", "target": "100 leads"}]
  }]
}' >/dev/null

loop2="$(curl -sf "${auth[@]}" "$base/kpi-closed-loop")"
echo "$loop2" | grep -q '"has_applied_kpi_tree":true' && echo "OK applied KPI tree" || echo "WARN has_applied_kpi_tree false"

# D2 — weekly memo job (no auto-apply TMMT)
memo="$(curl -sf "${auth[@]}" -X POST "$base/jobs/optimize/weekly-memo" -d '{"notify":false,"dry_run":true}')"
echo "$memo" | grep -q '"memo"' || { echo "FAIL weekly-memo job"; exit 1; }
echo "$memo" | grep -q '"auto_apply":false' && echo "OK weekly memo BR-MKTP-01" || echo "WARN auto_apply flag"

# D3 — competitor snapshot regenerate
snap="$(curl -sf "${auth[@]}" -X POST "$base/jobs/strategy/competitor-snapshot" -d '{}')"
echo "$snap" | grep -q '"job_id"' || { echo "FAIL competitor-snapshot job"; exit 1; }
echo "$snap" | grep -q 'competitor_snapshot' && echo "OK competitor_snapshot output" || echo "WARN competitor_snapshot in output"

# D4 — admin cron status
status="$(curl -sf "${auth[@]}" "$admin_base/closed-loop/status")"
echo "$status" | grep -q '"closed_loop_enabled":true' && echo "OK closed-loop admin status" || echo "WARN closed-loop status"

memo_status="$(curl -sf "${auth[@]}" "$admin_base/weekly-memo/status")"
echo "$memo_status" | grep -q '"cron_expression"' && echo "OK weekly-memo cron status" || echo "WARN weekly-memo status"

echo "PASS smoke_mkt_ai_plan_depth_wave3"
