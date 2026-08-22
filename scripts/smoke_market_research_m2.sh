#!/usr/bin/env bash
# Smoke M2 — Market Research OS: source → evidence → verify → PATCH 409.
#
# Live API (flag on + staff token):
#   API_BASE=http://127.0.0.1:3000 ACCESS_TOKEN=... CLIENT_ID=acme \
#     ./scripts/smoke_market_research_m2.sh
#
# Skip live if API is down (documents the contract and exits 0).
set -euo pipefail

API_BASE="${API_BASE:-http://127.0.0.1:3000}"
HEALTH_URL="$API_BASE/api/v1/research/health"

echo "==> GET $HEALTH_URL"
HTTP_CODE="$(curl -sS -o /tmp/mr_m2_health.json -w '%{http_code}' "$HEALTH_URL" || true)"
BODY="$(cat /tmp/mr_m2_health.json 2>/dev/null || true)"
echo "http=$HTTP_CODE body=$BODY"

if [[ "$HTTP_CODE" != "200" ]]; then
  echo "SKIP live M2 — health not 200 (flag off, API down, or unauthenticated path)."
  echo "Contract:"
  echo "  POST $API_BASE/api/v1/research/projects/:id/sources"
  echo "    {\"title\":\"Euromonitor dairy VN\",\"url\":\"https://example.com\",\"ai_generated\":false implied}"
  echo "  POST $API_BASE/api/v1/research/projects/:id/evidence"
  echo "    {\"source_id\":SID,\"locator\":\"https://example.com#p3\",\"excerpt\":\"TAM 12.5\"}"
  echo "  POST $API_BASE/api/v1/research/evidence/:id/verify"
  echo "    expect qc_status=verified and checksum sha256(locator|excerpt|value_num|unit|period_note|geography)"
  echo "  PATCH $API_BASE/api/v1/research/evidence/:id {\"excerpt\":\"changed\"}"
  echo "    expect 409 {error:evidence_immutable}"
  echo "  value_num without unit/value_base/period_note/geography → 400 validation_error (BR-RES-02)"
  exit 0
fi

if [[ -z "${ACCESS_TOKEN:-}" || -z "${CLIENT_ID:-}" ]]; then
  echo "SKIP live M2 — set ACCESS_TOKEN and CLIENT_ID"
  exit 0
fi

AUTH=( -H "Authorization: Bearer $ACCESS_TOKEN" -H "Content-Type: application/json" )
TITLE="Smoke M2 Acme $(date +%s)"

echo "==> POST /api/v1/research/projects"
HTTP_CODE="$(curl -sS -o /tmp/mr_m2_create.json -w '%{http_code}' "${AUTH[@]}" \
  -X POST "$API_BASE/api/v1/research/projects" \
  -d "{\"client_id\":\"$CLIENT_ID\",\"title\":\"$TITLE\",\"product_type\":\"CAT_REVIEW\",\"dv12_tier\":\"CB\",\"decision_statement\":\"Quyết định có mở SKU premium Q4 hay không.\",\"geo\":[\"VN\"],\"languages\":[\"vi\"],\"risk_class\":\"low\",\"questions\":[{\"question_vi\":\"Quy mô thị trường sữa uống VN?\",\"sort_order\":1}]}")"
echo "http=$HTTP_CODE body=$(cat /tmp/mr_m2_create.json)"
[[ "$HTTP_CODE" == "201" ]]
PID="$(python3 -c "import json; print(json.load(open('/tmp/mr_m2_create.json'))['project']['id'])")"

echo "==> POST /projects/$PID/sources"
HTTP_CODE="$(curl -sS -o /tmp/mr_m2_source.json -w '%{http_code}' "${AUTH[@]}" \
  -X POST "$API_BASE/api/v1/research/projects/$PID/sources" \
  -d '{"title":"Euromonitor dairy VN","url":"https://example.com/dairy","publisher":"Euromonitor"}')"
echo "http=$HTTP_CODE body=$(cat /tmp/mr_m2_source.json)"
[[ "$HTTP_CODE" == "201" ]]
SID="$(python3 -c "import json; print(json.load(open('/tmp/mr_m2_source.json'))['id'])")"
python3 - <<'PY'
import json
row=json.load(open('/tmp/mr_m2_source.json'))
assert row.get('ai_generated') is False, row
print('OK  source ai_generated=false id=', row['id'])
PY

echo "==> POST evidence missing BR-RES-02 fields (expect 400)"
HTTP_CODE="$(curl -sS -o /tmp/mr_m2_br.json -w '%{http_code}' "${AUTH[@]}" \
  -X POST "$API_BASE/api/v1/research/projects/$PID/evidence" \
  -d "{\"source_id\":$SID,\"locator\":\"https://example.com#p3\",\"value_num\":12.5}")"
echo "http=$HTTP_CODE body=$(cat /tmp/mr_m2_br.json)"
[[ "$HTTP_CODE" == "400" ]]
python3 - <<'PY'
import json
body=json.load(open('/tmp/mr_m2_br.json'))
blob=json.dumps(body)
assert 'validation_error' in blob, body
print('OK  BR-RES-02 validation_error')
PY

echo "==> POST /projects/$PID/evidence"
HTTP_CODE="$(curl -sS -o /tmp/mr_m2_ev.json -w '%{http_code}' "${AUTH[@]}" \
  -X POST "$API_BASE/api/v1/research/projects/$PID/evidence" \
  -d "{\"source_id\":$SID,\"locator\":\"https://example.com#p3\",\"excerpt\":\"TAM sữa uống 12.5\"}")"
echo "http=$HTTP_CODE body=$(cat /tmp/mr_m2_ev.json)"
[[ "$HTTP_CODE" == "201" ]]
EID="$(python3 -c "import json; print(json.load(open('/tmp/mr_m2_ev.json'))['id'])")"

echo "==> POST /evidence/$EID/verify"
HTTP_CODE="$(curl -sS -o /tmp/mr_m2_ver.json -w '%{http_code}' "${AUTH[@]}" \
  -X POST "$API_BASE/api/v1/research/evidence/$EID/verify")"
echo "http=$HTTP_CODE body=$(cat /tmp/mr_m2_ver.json)"
[[ "$HTTP_CODE" == "200" || "$HTTP_CODE" == "201" ]]
python3 - <<'PY'
import json
row=json.load(open('/tmp/mr_m2_ver.json'))
assert row.get('qc_status')=='verified', row
assert row.get('checksum'), row
print('OK  verified checksum=', row['checksum'][:12], '…')
PY

echo "==> PATCH /evidence/$EID excerpt (expect 409 evidence_immutable)"
HTTP_CODE="$(curl -sS -o /tmp/mr_m2_patch.json -w '%{http_code}' "${AUTH[@]}" \
  -X PATCH "$API_BASE/api/v1/research/evidence/$EID" \
  -d '{"excerpt":"changed after lock"}')"
echo "http=$HTTP_CODE body=$(cat /tmp/mr_m2_patch.json)"
[[ "$HTTP_CODE" == "409" ]]
python3 - <<'PY'
import json
body=json.load(open('/tmp/mr_m2_patch.json'))
blob=json.dumps(body)
assert 'evidence_immutable' in blob, body
print('OK  PATCH blocked evidence_immutable')
PY

echo "==> GET /projects/$PID includes sources + evidence"
HTTP_CODE="$(curl -sS -o /tmp/mr_m2_get.json -w '%{http_code}' "${AUTH[@]}" \
  "$API_BASE/api/v1/research/projects/$PID")"
[[ "$HTTP_CODE" == "200" ]]
python3 - <<PY
import json
data=json.load(open('/tmp/mr_m2_get.json'))
assert any(s['id']==$SID for s in data.get('sources', [])), data
assert any(e['id']==$EID and e.get('qc_status')=='verified' for e in data.get('evidence', [])), data
print('OK  workspace bundle has source + verified evidence')
PY

echo "OK  market research M2 smoke"
