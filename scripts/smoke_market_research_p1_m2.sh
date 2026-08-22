#!/usr/bin/env bash
# Smoke P1 M2 — Market Research OS: competitor + snapshot + BR-RES-09.
#
# Live API (flag on + staff token):
#   API_BASE=http://127.0.0.1:3000 ACCESS_TOKEN=... CLIENT_ID=acme \
#     ./scripts/smoke_market_research_p1_m2.sh
#
# Skip live if API is down (documents the contract and exits 0).
set -euo pipefail

API_BASE="${API_BASE:-http://127.0.0.1:3000}"
HEALTH_URL="$API_BASE/api/v1/research/health"

echo "==> GET $HEALTH_URL"
HTTP_CODE="$(curl -sS -o /tmp/mr_p1_m2_health.json -w '%{http_code}' "$HEALTH_URL" || true)"
BODY="$(cat /tmp/mr_p1_m2_health.json 2>/dev/null || true)"
echo "http=$HTTP_CODE body=$BODY"

if [[ "$HTTP_CODE" != "200" ]]; then
  echo "SKIP live P1 M2 competitor — health not 200 (flag off, API down, or unauthenticated path)."
  echo "Contract:"
  echo "  POST $API_BASE/api/v1/research/projects/:id/competitors {\"name\":\"Vinamilk\",\"aliases\":[\"VNM\"]}"
  echo "  GET  $API_BASE/api/v1/research/projects/:id/competitors  (includes snapshots)"
  echo "  PATCH $API_BASE/api/v1/research/competitors/:id {\"name\",\"aliases\"}"
  echo "  POST $API_BASE/api/v1/research/competitors/:id/snapshots"
  echo "    {\"source_id\":N,\"observed_at\":\"2026-08-01\",\"kind\":\"fact\",\"fact\":{\"price\":\"12000\"},\"limitation_note\":\"…\"}"
  echo "  snapshot without source_id → 400 {error:validation_error}"
  echo "  Similarweb + reliability_tier high → reliability_capped"
  echo "  cross-tenant GET → 403 {error:forbidden} without competitor name"
  exit 0
fi

if [[ -z "${ACCESS_TOKEN:-}" || -z "${CLIENT_ID:-}" ]]; then
  echo "SKIP live P1 M2 competitor — set ACCESS_TOKEN and CLIENT_ID"
  exit 0
fi

AUTH=( -H "Authorization: Bearer $ACCESS_TOKEN" -H "Content-Type: application/json" )
TITLE="Smoke P1 M2 Acme $(date +%s)"

echo "==> POST /api/v1/research/projects"
HTTP_CODE="$(curl -sS -o /tmp/mr_p1_m2_create.json -w '%{http_code}' "${AUTH[@]}" \
  -X POST "$API_BASE/api/v1/research/projects" \
  -d "{\"client_id\":\"$CLIENT_ID\",\"title\":\"$TITLE\",\"product_type\":\"COMP_LAND\",\"dv12_tier\":\"CB\",\"decision_statement\":\"Quyết định có mở SKU premium Q4 hay không.\",\"geo\":[\"VN\"],\"languages\":[\"vi\"],\"risk_class\":\"low\",\"questions\":[{\"question_vi\":\"Đối thủ sữa uống VN?\",\"sort_order\":1}]}")"
echo "http=$HTTP_CODE body=$(cat /tmp/mr_p1_m2_create.json)"
[[ "$HTTP_CODE" == "201" ]]
PID="$(python3 -c "import json; print(json.load(open('/tmp/mr_p1_m2_create.json'))['project']['id'])")"

echo "==> POST /projects/$PID/sources"
HTTP_CODE="$(curl -sS -o /tmp/mr_p1_m2_source.json -w '%{http_code}' "${AUTH[@]}" \
  -X POST "$API_BASE/api/v1/research/projects/$PID/sources" \
  -d '{"title":"Euromonitor dairy VN","url":"https://example.com/dairy","publisher":"Euromonitor"}')"
[[ "$HTTP_CODE" == "201" ]]
SID="$(python3 -c "import json; print(json.load(open('/tmp/mr_p1_m2_source.json'))['id'])")"

echo "==> POST /projects/$PID/competitors"
HTTP_CODE="$(curl -sS -o /tmp/mr_p1_m2_comp.json -w '%{http_code}' "${AUTH[@]}" \
  -X POST "$API_BASE/api/v1/research/projects/$PID/competitors" \
  -d '{"name":"Vinamilk","aliases":["VNM"]}')"
echo "http=$HTTP_CODE body=$(cat /tmp/mr_p1_m2_comp.json)"
[[ "$HTTP_CODE" == "201" ]]
CID="$(python3 -c "import json; print(json.load(open('/tmp/mr_p1_m2_comp.json'))['id'])")"

echo "==> POST /competitors/$CID/snapshots missing source_id"
HTTP_CODE="$(curl -sS -o /tmp/mr_p1_m2_snap_bad.json -w '%{http_code}' "${AUTH[@]}" \
  -X POST "$API_BASE/api/v1/research/competitors/$CID/snapshots" \
  -d '{"observed_at":"2026-08-01","kind":"fact","fact":{"price":"12000"}}')"
echo "http=$HTTP_CODE body=$(cat /tmp/mr_p1_m2_snap_bad.json)"
[[ "$HTTP_CODE" == "400" ]]
python3 - <<'PY'
import json
row=json.load(open('/tmp/mr_p1_m2_snap_bad.json'))
payload=row.get('message') if isinstance(row.get('message'), dict) else row
assert payload.get('error')=='validation_error' or row.get('error')=='validation_error', row
PY

echo "==> POST /competitors/$CID/snapshots"
HTTP_CODE="$(curl -sS -o /tmp/mr_p1_m2_snap.json -w '%{http_code}' "${AUTH[@]}" \
  -X POST "$API_BASE/api/v1/research/competitors/$CID/snapshots" \
  -d "{\"source_id\":$SID,\"observed_at\":\"2026-08-01\",\"kind\":\"fact\",\"fact\":{\"price\":\"12000\"}}")"
echo "http=$HTTP_CODE body=$(cat /tmp/mr_p1_m2_snap.json)"
[[ "$HTTP_CODE" == "201" ]]

echo "==> GET /projects/$PID/competitors"
HTTP_CODE="$(curl -sS -o /tmp/mr_p1_m2_list.json -w '%{http_code}' "${AUTH[@]}" \
  "$API_BASE/api/v1/research/projects/$PID/competitors")"
[[ "$HTTP_CODE" == "200" ]]
python3 - <<'PY'
import json
row=json.load(open('/tmp/mr_p1_m2_list.json'))
comps=row.get('competitors') or []
assert comps and comps[0].get('name')=='Vinamilk', row
assert comps[0].get('snapshots'), row
print('OK  competitor+', len(comps[0]['snapshots']), 'snapshot(s)')
PY

echo "OK  market research P1 M2 smoke"
