#!/usr/bin/env bash
# Smoke P2 M2 — Market Research OS: pulse agent + trend signals.
#
# Live API (flag on + staff token):
#   API_BASE=http://127.0.0.1:3000 ACCESS_TOKEN=... CLIENT_ID=acme \
#     ./scripts/smoke_market_research_p2_m2.sh
#
# Skip live if API is down (documents the contract and exits 0).
set -euo pipefail

API_BASE="${API_BASE:-http://127.0.0.1:3000}"
HEALTH_URL="$API_BASE/api/v1/research/health"

echo "==> GET $HEALTH_URL"
HTTP_CODE="$(curl -sS -o /tmp/mr_p2_m2_health.json -w '%{http_code}' "$HEALTH_URL" || true)"
BODY="$(cat /tmp/mr_p2_m2_health.json 2>/dev/null || true)"
echo "http=$HTTP_CODE body=$BODY"

if [[ "$HTTP_CODE" != "200" ]]; then
  echo "SKIP live P2 M2 pulse — health not 200 (flag off, API down, or unauthenticated path)."
  echo "Contract:"
  echo "  POST $API_BASE/api/v1/research/projects/:id/run-pulse {\"question_id\":N} cap run"
  echo "  in-flight → 409 {error:job_in_flight}"
  echo "  job_type research_pulse; never createInsight / published"
  echo "  snapshot price/message/promo diff → crm_research_trend_signals"
  echo "  lifecycle_id set → ops_alert_log dv_code=DV12 alert_type=research_pulse"
  echo "  no lifecycle_id → insert signal, no upsertAlert"
  echo "  Tavily query = question_vi + geo after strip_pii (phone stripped)"
  exit 0
fi

if [[ -z "${ACCESS_TOKEN:-}" || -z "${CLIENT_ID:-}" ]]; then
  echo "SKIP live P2 M2 pulse — set ACCESS_TOKEN and CLIENT_ID"
  exit 0
fi

AUTH=( -H "Authorization: Bearer $ACCESS_TOKEN" -H "Content-Type: application/json" )
TITLE="Smoke P2 M2 Pulse $(date +%s)"

echo "==> POST /api/v1/research/projects"
HTTP_CODE="$(curl -sS -o /tmp/mr_p2_m2_create.json -w '%{http_code}' "${AUTH[@]}" \
  -X POST "$API_BASE/api/v1/research/projects" \
  -d "{\"client_id\":\"$CLIENT_ID\",\"title\":\"$TITLE\",\"product_type\":\"COMP_LAND\",\"dv12_tier\":\"CB\",\"decision_statement\":\"Quyết định có mở SKU premium Q4 hay không.\",\"geo\":[\"VN\"],\"languages\":[\"vi\"],\"risk_class\":\"low\",\"questions\":[{\"question_vi\":\"Giá đối thủ trend thế nào?\",\"sort_order\":1}]}")"
echo "http=$HTTP_CODE body=$(cat /tmp/mr_p2_m2_create.json)"
[[ "$HTTP_CODE" == "201" ]]
PID="$(python3 -c "import json; print(json.load(open('/tmp/mr_p2_m2_create.json'))['project']['id'])")"
QID="$(python3 -c "import json; print(json.load(open('/tmp/mr_p2_m2_create.json'))['project']['questions'][0]['id'])")"

echo "==> POST /projects/$PID/competitors"
HTTP_CODE="$(curl -sS -o /tmp/mr_p2_m2_comp.json -w '%{http_code}' "${AUTH[@]}" \
  -X POST "$API_BASE/api/v1/research/projects/$PID/competitors" \
  -d '{"name":"RivalCo"}')"
echo "http=$HTTP_CODE body=$(cat /tmp/mr_p2_m2_comp.json)"
[[ "$HTTP_CODE" == "201" ]]
CID="$(python3 -c "import json; print(json.load(open('/tmp/mr_p2_m2_comp.json'))['id'])")"

echo "==> POST source + two snapshots price 10 then 12"
HTTP_CODE="$(curl -sS -o /tmp/mr_p2_m2_src.json -w '%{http_code}' "${AUTH[@]}" \
  -X POST "$API_BASE/api/v1/research/projects/$PID/sources" \
  -d '{"title":"Price card","source_type":"web","url":"https://example.com/price"}')"
[[ "$HTTP_CODE" == "201" ]]
SID="$(python3 -c "import json; print(json.load(open('/tmp/mr_p2_m2_src.json'))['id'])")"

HTTP_CODE="$(curl -sS -o /tmp/mr_p2_m2_snap1.json -w '%{http_code}' "${AUTH[@]}" \
  -X POST "$API_BASE/api/v1/research/competitors/$CID/snapshots" \
  -d "{\"source_id\":$SID,\"kind\":\"fact\",\"fact\":{\"price\":\"10\"}}")"
echo "snap1 http=$HTTP_CODE"
[[ "$HTTP_CODE" == "201" ]]

HTTP_CODE="$(curl -sS -o /tmp/mr_p2_m2_snap2.json -w '%{http_code}' "${AUTH[@]}" \
  -X POST "$API_BASE/api/v1/research/competitors/$CID/snapshots" \
  -d "{\"source_id\":$SID,\"kind\":\"fact\",\"fact\":{\"price\":\"12\"}}")"
echo "snap2 http=$HTTP_CODE"
[[ "$HTTP_CODE" == "201" ]]

echo "==> POST /projects/$PID/run-pulse"
HTTP_CODE="$(curl -sS -o /tmp/mr_p2_m2_pulse.json -w '%{http_code}' "${AUTH[@]}" \
  -X POST "$API_BASE/api/v1/research/projects/$PID/run-pulse" \
  -d "{\"question_id\":$QID}")"
echo "http=$HTTP_CODE body=$(cat /tmp/mr_p2_m2_pulse.json)"
[[ "$HTTP_CODE" == "202" || "$HTTP_CODE" == "409" ]]

echo "==> GET /projects/$PID (signals, no new published insight from pulse)"
HTTP_CODE="$(curl -sS -o /tmp/mr_p2_m2_proj.json -w '%{http_code}' "${AUTH[@]}" \
  "$API_BASE/api/v1/research/projects/$PID")"
[[ "$HTTP_CODE" == "200" ]]
python3 - <<'PY'
import json
row=json.load(open('/tmp/mr_p2_m2_proj.json'))
signals=row.get('trend_signals') or []
assert signals, row
assert all(s.get('topic') for s in signals), row
insights=row.get('insights') or []
assert not any(i.get('status')=='published' for i in insights), insights
print('OK  pulse signals+', len(signals))
PY

echo "OK  market research P2 M2 smoke"
