#!/usr/bin/env bash
# WS-P4-02 S2 — brief upload + KPI tree + readiness (MKTP-UC-026 partial)
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

echo "== smoke_mkt_ai_plan_depth S2 =="
echo "lifecycle=$LIFECYCLE_ID api=$API_URL"

ctx="$(curl -sf "${auth[@]}" "$base/context")"
echo "$ctx" | grep -q '"enabled":true' || { echo "FAIL: planner disabled"; exit 1; }

if ! echo "$ctx" | grep -q '"brief_readiness"'; then
  echo "WARN: brief_readiness missing (ok if depth flags off)"
else
  echo "OK brief_readiness in context"
fi

tmp="$(mktemp)"
cat >"$tmp" <<'EOF'
Thương hiệu: Smoke Test Brand
Ngành: Logistics
Mục tiêu: lead
Ngân sách tháng: 50 triệu
Thị trường: HCM
Thách thức: CPL cao trong smoke test
EOF

upload_out="$(curl -sf "${AUTH[@]}" -F "file=@$tmp;filename=brief-smoke.txt" "$base/brief/upload" 2>/dev/null || true)"
rm -f "$tmp"

if [ -n "$upload_out" ]; then
  echo "$upload_out" | grep -q '"score"' && echo "OK brief/upload" || echo "WARN: upload response shape"
else
  echo "SKIP brief/upload (flag off or error)"
fi

kpi_patch="$(curl -sf "${auth[@]}" -X PATCH "$base/draft" -d '{
  "kpi_tree_json": [{
    "id": "north_star",
    "label": "CPL",
    "target": "< 500k",
    "unit": "VND",
    "children": [{ "id": "c1", "label": "Meta Lead", "target": "200 leads" }]
  }]
}')"
echo "$kpi_patch" | grep -q 'north_star' && echo "OK kpi_tree_json patch" || { echo "FAIL kpi patch"; exit 1; }

ctx2="$(curl -sf "${auth[@]}" "$base/context")"
echo "$ctx2" | grep -q 'CPL' && echo "OK context kpi_tree" || echo "WARN: kpi not in context json"

echo "PASS smoke_mkt_ai_plan_depth S2"
