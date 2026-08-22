#!/usr/bin/env bash
# Smoke M1 — Market Research OS: project CRUD + RQ + designed gate.
#
# Live API (flag on + staff token):
#   API_BASE=http://127.0.0.1:3000 ACCESS_TOKEN=... CLIENT_ID=acme \
#     ./scripts/smoke_market_research_m1.sh
#
# Skip live if API is down (documents the contract and exits 0).
set -euo pipefail

API_BASE="${API_BASE:-http://127.0.0.1:3000}"
HEALTH_URL="$API_BASE/api/v1/research/health"

echo "==> GET $HEALTH_URL"
HTTP_CODE="$(curl -sS -o /tmp/mr_m1_health.json -w '%{http_code}' "$HEALTH_URL" || true)"
BODY="$(cat /tmp/mr_m1_health.json 2>/dev/null || true)"
echo "http=$HTTP_CODE body=$BODY"

if [[ "$HTTP_CODE" != "200" ]]; then
  echo "SKIP live CRUD — health not 200 (flag off, API down, or unauthenticated path)."
  echo "Contract:"
  echo "  POST $API_BASE/api/v1/research/projects"
  echo "    Authorization: Bearer \$ACCESS_TOKEN"
  echo "    {\"client_id\":\"\$CLIENT_ID\",\"title\":\"Category review Acme 2026\","
  echo "     \"product_type\":\"CAT_REVIEW\",\"dv12_tier\":\"CB\","
  echo "     \"decision_statement\":\"Quyết định có mở SKU premium Q4 hay không.\","
  echo "     \"geo\":[\"VN\"],\"languages\":[\"vi\"],\"risk_class\":\"low\","
  echo "     \"questions\":[{\"question_vi\":\"Quy mô thị trường?\",\"sort_order\":1}]}"
  echo "  expect 201 {ok:true, project.status=intake}"
  echo "  GET  $API_BASE/api/v1/research/projects  → list contains id"
  echo "  PATCH .../projects/:id {\"status\":\"designed\"} after deleting all RQ → 409 need_rq"
  echo "  GET  other-tenant project → 403 {error:forbidden} without title"
  exit 0
fi

if [[ -z "${ACCESS_TOKEN:-}" || -z "${CLIENT_ID:-}" ]]; then
  echo "SKIP live CRUD — set ACCESS_TOKEN and CLIENT_ID"
  exit 0
fi

AUTH=( -H "Authorization: Bearer $ACCESS_TOKEN" -H "Content-Type: application/json" )
TITLE="Smoke M1 Acme $(date +%s)"

echo "==> POST /api/v1/research/projects"
HTTP_CODE="$(curl -sS -o /tmp/mr_m1_create.json -w '%{http_code}' "${AUTH[@]}" \
  -X POST "$API_BASE/api/v1/research/projects" \
  -d "{\"client_id\":\"$CLIENT_ID\",\"title\":\"$TITLE\",\"product_type\":\"CAT_REVIEW\",\"dv12_tier\":\"CB\",\"decision_statement\":\"Quyết định có mở SKU premium Q4 hay không.\",\"geo\":[\"VN\"],\"languages\":[\"vi\"],\"risk_class\":\"low\",\"questions\":[{\"question_vi\":\"Quy mô thị trường sữa uống VN?\",\"sort_order\":1}]}")"
echo "http=$HTTP_CODE body=$(cat /tmp/mr_m1_create.json)"
[[ "$HTTP_CODE" == "201" ]]
ID="$(python3 -c "import json; print(json.load(open('/tmp/mr_m1_create.json'))['project']['id'])")"
echo "OK  created id=$ID"

echo "==> GET /api/v1/research/projects"
HTTP_CODE="$(curl -sS -o /tmp/mr_m1_list.json -w '%{http_code}' "${AUTH[@]}" \
  "$API_BASE/api/v1/research/projects?q=$(python3 -c "import urllib.parse; print(urllib.parse.quote('''$TITLE'''))")")"
echo "http=$HTTP_CODE"
[[ "$HTTP_CODE" == "200" ]]
python3 - <<PY
import json
data=json.load(open('/tmp/mr_m1_list.json'))
ids=[p['id'] for p in data.get('projects', [])]
assert $ID in ids, data
print('OK  list contains', $ID)
PY

echo "==> GET /api/v1/research/projects/$ID"
HTTP_CODE="$(curl -sS -o /tmp/mr_m1_get.json -w '%{http_code}' "${AUTH[@]}" \
  "$API_BASE/api/v1/research/projects/$ID")"
[[ "$HTTP_CODE" == "200" ]]
QID="$(python3 -c "import json; print(json.load(open('/tmp/mr_m1_get.json'))['questions'][0]['id'])")"

echo "==> DELETE question $QID then PATCH designed (expect 409 need_rq)"
curl -sS -o /tmp/mr_m1_del.json -w "delete http=%{http_code}\n" "${AUTH[@]}" \
  -X DELETE "$API_BASE/api/v1/research/questions/$QID"
HTTP_CODE="$(curl -sS -o /tmp/mr_m1_designed.json -w '%{http_code}' "${AUTH[@]}" \
  -X PATCH "$API_BASE/api/v1/research/projects/$ID" \
  -d '{"status":"designed"}')"
echo "http=$HTTP_CODE body=$(cat /tmp/mr_m1_designed.json)"
[[ "$HTTP_CODE" == "409" ]]
python3 - <<'PY'
import json
body=json.load(open('/tmp/mr_m1_designed.json'))
assert body.get('error')=='invalid_transition', body
assert body.get('reason')=='need_rq', body
print('OK  designed blocked need_rq')
PY

echo "OK  market research M1 smoke"
