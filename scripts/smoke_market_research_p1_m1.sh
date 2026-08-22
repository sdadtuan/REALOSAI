#!/usr/bin/env bash
# Smoke P1 M1 — Market Research OS: confidence rubric + BR-RES-03.
#
# Live API (flag on + staff token):
#   API_BASE=http://127.0.0.1:3000 ACCESS_TOKEN=... CLIENT_ID=acme \
#     ./scripts/smoke_market_research_p1_m1.sh
#
# Skip live if API is down (documents the contract and exits 0).
set -euo pipefail

API_BASE="${API_BASE:-http://127.0.0.1:3000}"
HEALTH_URL="$API_BASE/api/v1/research/health"

echo "==> GET $HEALTH_URL"
HTTP_CODE="$(curl -sS -o /tmp/mr_p1_m1_health.json -w '%{http_code}' "$HEALTH_URL" || true)"
BODY="$(cat /tmp/mr_p1_m1_health.json 2>/dev/null || true)"
echo "http=$HTTP_CODE body=$BODY"

if [[ "$HTTP_CODE" != "200" ]]; then
  echo "SKIP live P1 M1 rubric — health not 200 (flag off, API down, or unauthenticated path)."
  echo "Contract:"
  echo "  POST $API_BASE/api/v1/research/projects/:id/insights"
  echo "    {\"statement\":\"…\",\"confidence_rationale\":\"Nguồn verified\","
  echo "     \"confidence_json\":{\"S\":4,\"F\":4,\"T\":4,\"A\":4,\"R\":4}}"
  echo "  POST $API_BASE/api/v1/research/insights/:id/attach-evidence {\"evidence_ids\":[EID]}"
  echo "  POST $API_BASE/api/v1/research/insights/:id/submit-review"
  echo "    expect confidence_json.band present (server-computed)"
  echo "  submit-review without 5-dim rubric → 400 {error:insight_gate, messages:[missing_confidence_rubric]}"
  echo "  rationale with \"95% confidence\" and statistical_inference=false → forbidden_confidence_wording"
  exit 0
fi

if [[ -z "${ACCESS_TOKEN:-}" || -z "${CLIENT_ID:-}" ]]; then
  echo "SKIP live P1 M1 rubric — set ACCESS_TOKEN and CLIENT_ID"
  exit 0
fi

AUTH=( -H "Authorization: Bearer $ACCESS_TOKEN" -H "Content-Type: application/json" )
TITLE="Smoke P1 M1 Acme $(date +%s)"

echo "==> POST /api/v1/research/projects"
HTTP_CODE="$(curl -sS -o /tmp/mr_p1_m1_create.json -w '%{http_code}' "${AUTH[@]}" \
  -X POST "$API_BASE/api/v1/research/projects" \
  -d "{\"client_id\":\"$CLIENT_ID\",\"title\":\"$TITLE\",\"product_type\":\"CAT_REVIEW\",\"dv12_tier\":\"CB\",\"decision_statement\":\"Quyết định có mở SKU premium Q4 hay không.\",\"geo\":[\"VN\"],\"languages\":[\"vi\"],\"risk_class\":\"low\",\"questions\":[{\"question_vi\":\"Quy mô thị trường sữa uống VN?\",\"sort_order\":1}]}")"
echo "http=$HTTP_CODE body=$(cat /tmp/mr_p1_m1_create.json)"
[[ "$HTTP_CODE" == "201" ]]
PID="$(python3 -c "import json; print(json.load(open('/tmp/mr_p1_m1_create.json'))['project']['id'])")"

echo "==> POST /projects/$PID/sources"
HTTP_CODE="$(curl -sS -o /tmp/mr_p1_m1_source.json -w '%{http_code}' "${AUTH[@]}" \
  -X POST "$API_BASE/api/v1/research/projects/$PID/sources" \
  -d '{"title":"Euromonitor dairy VN","url":"https://example.com/dairy","publisher":"Euromonitor"}')"
[[ "$HTTP_CODE" == "201" ]]
SID="$(python3 -c "import json; print(json.load(open('/tmp/mr_p1_m1_source.json'))['id'])")"

echo "==> POST /projects/$PID/evidence"
HTTP_CODE="$(curl -sS -o /tmp/mr_p1_m1_ev.json -w '%{http_code}' "${AUTH[@]}" \
  -X POST "$API_BASE/api/v1/research/projects/$PID/evidence" \
  -d "{\"source_id\":$SID,\"locator\":\"https://example.com#p3\",\"excerpt\":\"TAM sữa uống 12.5\"}")"
[[ "$HTTP_CODE" == "201" ]]
EID="$(python3 -c "import json; print(json.load(open('/tmp/mr_p1_m1_ev.json'))['id'])")"

echo "==> POST /evidence/$EID/verify"
HTTP_CODE="$(curl -sS -o /tmp/mr_p1_m1_ver.json -w '%{http_code}' "${AUTH[@]}" \
  -X POST "$API_BASE/api/v1/research/evidence/$EID/verify")"
[[ "$HTTP_CODE" == "200" || "$HTTP_CODE" == "201" ]]

echo "==> POST /projects/$PID/insights with rubric"
HTTP_CODE="$(curl -sS -o /tmp/mr_p1_m1_insight.json -w '%{http_code}' "${AUTH[@]}" \
  -X POST "$API_BASE/api/v1/research/projects/$PID/insights" \
  -d '{"statement":"Premium SKU tăng share ở MT HCM","confidence_rationale":"Nguồn verified, sample 2025","confidence_json":{"S":4,"F":4,"T":4,"A":4,"R":4}}')"
echo "http=$HTTP_CODE body=$(cat /tmp/mr_p1_m1_insight.json)"
[[ "$HTTP_CODE" == "201" ]]
IID="$(python3 -c "import json; print(json.load(open('/tmp/mr_p1_m1_insight.json'))['id'])")"

echo "==> POST /insights/$IID/attach-evidence"
HTTP_CODE="$(curl -sS -o /tmp/mr_p1_m1_attach.json -w '%{http_code}' "${AUTH[@]}" \
  -X POST "$API_BASE/api/v1/research/insights/$IID/attach-evidence" \
  -d "{\"evidence_ids\":[$EID]}")"
[[ "$HTTP_CODE" == "200" || "$HTTP_CODE" == "201" ]]

echo "==> POST /insights/$IID/submit-review"
HTTP_CODE="$(curl -sS -o /tmp/mr_p1_m1_submit.json -w '%{http_code}' "${AUTH[@]}" \
  -X POST "$API_BASE/api/v1/research/insights/$IID/submit-review" \
  -d '{"confidence_json":{"S":4,"F":4,"T":4,"A":4,"R":4}}')"
echo "http=$HTTP_CODE body=$(cat /tmp/mr_p1_m1_submit.json)"
[[ "$HTTP_CODE" == "200" || "$HTTP_CODE" == "201" ]]
python3 - <<'PY'
import json
row=json.load(open('/tmp/mr_p1_m1_submit.json'))
cj=row.get('confidence_json') or {}
assert cj.get('band'), row
print('OK  confidence_json.band=', cj.get('band'), 'score=', cj.get('score'))
PY

echo "OK  market research P1 M1 smoke"
