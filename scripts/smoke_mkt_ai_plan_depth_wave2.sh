#!/usr/bin/env bash
# WS-P4-04 — Plan depth Wave 2: scenarios, budget rationale, comments, PPTX (MKTP-UC-027/029)
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

echo "== smoke_mkt_ai_plan_depth_wave2 =="
echo "lifecycle=$LIFECYCLE_ID api=$API_URL"

ctx="$(curl -sf "${auth[@]}" "$base/context")"
echo "$ctx" | grep -q '"enabled":true' || { echo "FAIL: planner disabled"; exit 1; }

flags_ok=0
echo "$ctx" | grep -q '"scenario_compare_enabled":true' && flags_ok=$((flags_ok + 1)) || echo "WARN scenario_compare_enabled off"
echo "$ctx" | grep -q '"section_comments_enabled":true' && flags_ok=$((flags_ok + 1)) || echo "WARN section_comments_enabled off"
echo "$ctx" | grep -q '"export_pptx_enabled":true' && flags_ok=$((flags_ok + 1)) || echo "WARN export_pptx_enabled off"

if [[ "$flags_ok" -eq 0 ]]; then
  echo "FAIL: none of P4-04 flags enabled (PTT_MKT_AI_SCENARIO_COMPARE/SECTION_COMMENTS/EXPORT_PPTX)"
  exit 1
fi

# D1 — strategy scenarios
if echo "$ctx" | grep -q '"scenario_compare_enabled":true'; then
  scen_out="$(curl -sf "${auth[@]}" -X POST "$base/jobs/strategy/scenarios" -d '{"count":3}')"
  echo "$scen_out" | grep -q '"scenarios"' || { echo "FAIL strategy scenarios job"; exit 1; }
  scen_count="$(echo "$scen_out" | python3 -c "import sys,json; print(len(json.load(sys.stdin).get('scenarios') or []))" 2>/dev/null || echo 0)"
  [[ "$scen_count" -ge 2 ]] || { echo "FAIL expected >=2 strategy scenarios, got $scen_count"; exit 1; }
  id_a="$(echo "$scen_out" | python3 -c "import sys,json; s=json.load(sys.stdin).get('scenarios') or []; print(s[0]['id'] if s else '')" 2>/dev/null || true)"
  id_b="$(echo "$scen_out" | python3 -c "import sys,json; s=json.load(sys.stdin).get('scenarios') or []; print(s[1]['id'] if len(s)>1 else '')" 2>/dev/null || true)"
  if [[ -n "$id_a" && -n "$id_b" ]]; then
    cmp="$(curl -sf "${auth[@]}" "$base/strategy/scenarios/compare?a=$id_a&b=$id_b")"
    echo "$cmp" | grep -q '"scenario_a"' && echo "OK strategy compare A=$id_a B=$id_b" || echo "WARN compare shape"
  fi
else
  echo "SKIP strategy scenarios — flag off"
fi

# D2 — budget simulate with rationale_vi
budget_out="$(curl -sf "${auth[@]}" -X POST "$base/jobs/budget-simulate" -d '{"count":4}' 2>/dev/null || true)"
if [[ -n "$budget_out" ]]; then
  echo "$budget_out" | grep -q '"scenarios"' || { echo "FAIL budget simulate"; exit 1; }
  echo "$budget_out" | grep -q 'rationale_vi' && echo "OK budget rationale_vi" || echo "WARN rationale_vi missing in response"
else
  echo "WARN budget-simulate failed (brief budget missing?)"
fi

# D3 — section comment
if echo "$ctx" | grep -q '"section_comments_enabled":true'; then
  cmt="$(curl -sf "${auth[@]}" -X POST "$base/section-comments" -d '{
    "section_key": "segmentation_icp",
    "body": "Smoke comment WS-P4-04",
    "mention_email": "admin@pttads.vn"
  }')"
  echo "$cmt" | grep -q '"section_key":"segmentation_icp"' && echo "OK section comment" || { echo "FAIL section comment"; exit 1; }
  list="$(curl -sf "${auth[@]}" "$base/section-comments?section_key=segmentation_icp")"
  echo "$list" | grep -q 'Smoke comment WS-P4-04' && echo "OK section comment list" || echo "WARN comment list"
else
  echo "SKIP section comments — flag off"
fi

# D4 — PPTX export (needs quality >=60; best-effort)
if echo "$ctx" | grep -q '"export_pptx_enabled":true'; then
  score="$(echo "$ctx" | python3 -c "import sys,json; print(json.load(sys.stdin).get('quality_score',{}).get('score') or 0)" 2>/dev/null || echo 0)"
  if [[ "${score%%.*}" -ge 60 ]]; then
    pptx="$(curl -sf "${auth[@]}" -X POST "$base/export/pptx" -d '{"sections":["strategy","campaign"]}' 2>/dev/null || true)"
    if [[ -n "$pptx" ]]; then
      echo "$pptx" | grep -q '"format":"pptx"' && echo "OK export/pptx" || { echo "FAIL export/pptx shape"; exit 1; }
    else
      echo "WARN export/pptx blocked (approval or quality gate)"
    fi
  else
    echo "SKIP export/pptx — quality score $score < 60 (run quality job first)"
  fi
else
  echo "SKIP export/pptx — flag off"
fi

echo "PASS smoke_mkt_ai_plan_depth_wave2"
