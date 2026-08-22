#!/usr/bin/env bash
# Smoke P2 M1 — Market Research OS: studies + consent + transcript locator.
#
# Live API (flag on + staff token):
#   API_BASE=http://127.0.0.1:3000 ACCESS_TOKEN=... CLIENT_ID=acme \
#     ./scripts/smoke_market_research_p2_m1.sh
#
# Skip live if API is down (documents the contract and exits 0).
set -euo pipefail

API_BASE="${API_BASE:-http://127.0.0.1:3000}"
HEALTH_URL="$API_BASE/api/v1/research/health"

echo "==> GET $HEALTH_URL"
HTTP_CODE="$(curl -sS -o /tmp/mr_p2_m1_health.json -w '%{http_code}' "$HEALTH_URL" || true)"
BODY="$(cat /tmp/mr_p2_m1_health.json 2>/dev/null || true)"
echo "http=$HTTP_CODE body=$BODY"

if [[ "$HTTP_CODE" != "200" ]]; then
  echo "SKIP live P2 M1 studies — health not 200 (flag off, API down, or unauthenticated path)."
  echo "Contract:"
  echo "  POST $API_BASE/api/v1/research/projects/:id/studies {\"name\":\"IDI sữa\",\"method\":\"idi\",\"n\":8}"
  echo "  GET  $API_BASE/api/v1/research/projects/:id/studies"
  echo "  PATCH $API_BASE/api/v1/research/studies/:id {\"name\",\"n\",\"field_start\",\"field_end\",\"mode\"}"
  echo "  POST $API_BASE/api/v1/research/studies/:id/consents {\"subject_code\":\"R-004\",\"consent_type\":\"record\"}"
  echo "  consent notes with 0909123456 → 400 {error:consent_pii_forbidden}"
  echo "  POST evidence {study_id, locator:T-12:03, excerpt:800} → 400 {error:raw_transcript_forbidden}"
  echo "  cross-tenant GET studies → 403 {error:forbidden} without study name"
  exit 0
fi

if [[ -z "${ACCESS_TOKEN:-}" || -z "${CLIENT_ID:-}" ]]; then
  echo "SKIP live P2 M1 studies — set ACCESS_TOKEN and CLIENT_ID"
  exit 0
fi

AUTH=( -H "Authorization: Bearer $ACCESS_TOKEN" -H "Content-Type: application/json" )
TITLE="Smoke P2 M1 Acme $(date +%s)"

echo "==> POST /api/v1/research/projects"
HTTP_CODE="$(curl -sS -o /tmp/mr_p2_m1_create.json -w '%{http_code}' "${AUTH[@]}" \
  -X POST "$API_BASE/api/v1/research/projects" \
  -d "{\"client_id\":\"$CLIENT_ID\",\"title\":\"$TITLE\",\"product_type\":\"CONSUMER\",\"dv12_tier\":\"CB\",\"decision_statement\":\"Quyết định có mở SKU premium Q4 hay không.\",\"geo\":[\"VN\"],\"languages\":[\"vi\"],\"risk_class\":\"low\",\"questions\":[{\"question_vi\":\"Hành vi uống sữa?\",\"sort_order\":1}]}")"
echo "http=$HTTP_CODE body=$(cat /tmp/mr_p2_m1_create.json)"
[[ "$HTTP_CODE" == "201" ]]
PID="$(python3 -c "import json; print(json.load(open('/tmp/mr_p2_m1_create.json'))['project']['id'])")"

echo "==> POST /projects/$PID/studies"
HTTP_CODE="$(curl -sS -o /tmp/mr_p2_m1_study.json -w '%{http_code}' "${AUTH[@]}" \
  -X POST "$API_BASE/api/v1/research/projects/$PID/studies" \
  -d '{"name":"IDI sữa uống","method":"idi","n":8,"mode":"online"}')"
echo "http=$HTTP_CODE body=$(cat /tmp/mr_p2_m1_study.json)"
[[ "$HTTP_CODE" == "201" ]]
SID="$(python3 -c "import json; print(json.load(open('/tmp/mr_p2_m1_study.json'))['id'])")"

echo "==> POST /studies/$SID/consents with phone notes"
HTTP_CODE="$(curl -sS -o /tmp/mr_p2_m1_consent_bad.json -w '%{http_code}' "${AUTH[@]}" \
  -X POST "$API_BASE/api/v1/research/studies/$SID/consents" \
  -d '{"subject_code":"R-004","consent_type":"record","notes":"gọi 0909123456"}')"
echo "http=$HTTP_CODE body=$(cat /tmp/mr_p2_m1_consent_bad.json)"
[[ "$HTTP_CODE" == "400" ]]
python3 - <<'PY'
import json
row=json.load(open('/tmp/mr_p2_m1_consent_bad.json'))
payload=row.get('message') if isinstance(row.get('message'), dict) else row
assert payload.get('error')=='consent_pii_forbidden' or row.get('error')=='consent_pii_forbidden', row
PY

echo "==> POST /studies/$SID/consents"
HTTP_CODE="$(curl -sS -o /tmp/mr_p2_m1_consent.json -w '%{http_code}' "${AUTH[@]}" \
  -X POST "$API_BASE/api/v1/research/studies/$SID/consents" \
  -d '{"subject_code":"R-004","consent_type":"record","notes":"ghi âm IDI"}')"
echo "http=$HTTP_CODE body=$(cat /tmp/mr_p2_m1_consent.json)"
[[ "$HTTP_CODE" == "201" ]]

echo "==> POST /projects/$PID/evidence study excerpt 800"
EXCERPT="$(python3 -c "print('x'*800)")"
HTTP_CODE="$(curl -sS -o /tmp/mr_p2_m1_ev_bad.json -w '%{http_code}' "${AUTH[@]}" \
  -X POST "$API_BASE/api/v1/research/projects/$PID/evidence" \
  -d "{\"study_id\":$SID,\"locator\":\"T-12:03\",\"excerpt\":\"$EXCERPT\"}")"
echo "http=$HTTP_CODE body=$(cat /tmp/mr_p2_m1_ev_bad.json)"
[[ "$HTTP_CODE" == "400" ]]
python3 - <<'PY'
import json
row=json.load(open('/tmp/mr_p2_m1_ev_bad.json'))
payload=row.get('message') if isinstance(row.get('message'), dict) else row
assert payload.get('error')=='raw_transcript_forbidden' or row.get('error')=='raw_transcript_forbidden', row
PY

echo "==> POST /projects/$PID/evidence study locator"
HTTP_CODE="$(curl -sS -o /tmp/mr_p2_m1_ev.json -w '%{http_code}' "${AUTH[@]}" \
  -X POST "$API_BASE/api/v1/research/projects/$PID/evidence" \
  -d "{\"study_id\":$SID,\"locator\":\"T-12:03\",\"excerpt\":\"premium SKU được nhắc 3 lần\"}")"
echo "http=$HTTP_CODE body=$(cat /tmp/mr_p2_m1_ev.json)"
[[ "$HTTP_CODE" == "201" ]]

echo "==> GET /projects/$PID/studies"
HTTP_CODE="$(curl -sS -o /tmp/mr_p2_m1_list.json -w '%{http_code}' "${AUTH[@]}" \
  "$API_BASE/api/v1/research/projects/$PID/studies")"
[[ "$HTTP_CODE" == "200" ]]
python3 - <<'PY'
import json
row=json.load(open('/tmp/mr_p2_m1_list.json'))
studies=row.get('studies') or []
assert studies and studies[0].get('name')=='IDI sữa uống', row
print('OK  studies+', len(studies))
PY

echo "OK  market research P2 M1 smoke"
