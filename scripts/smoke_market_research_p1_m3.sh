#!/usr/bin/env bash
# Smoke P1 M3 — Market Research OS: insert approved insight IDs into marketing-plan.
#
# Live API (flag on + staff token + existing plan):
#   API_BASE=http://127.0.0.1:3000 ACCESS_TOKEN=... CLIENT_ID=acme PLAN_ID=1 \
#     ./scripts/smoke_market_research_p1_m3.sh
#
# Skip live if API is down (documents the contract and exits 0).
set -euo pipefail

API_BASE="${API_BASE:-http://127.0.0.1:3000}"
HEALTH_URL="$API_BASE/api/v1/research/health"

echo "==> GET $HEALTH_URL"
HTTP_CODE="$(curl -sS -o /tmp/mr_p1_m3_health.json -w '%{http_code}' "$HEALTH_URL" || true)"
BODY="$(cat /tmp/mr_p1_m3_health.json 2>/dev/null || true)"
echo "http=$HTTP_CODE body=$BODY"

if [[ "$HTTP_CODE" != "200" ]]; then
  echo "SKIP live P1 M3 insert insight — health not 200 (flag off, API down, or unauthenticated path)."
  echo "Contract:"
  echo "  GET  $API_BASE/api/v1/research/insights?client_id=CLIENT  (approved_internal+ only; statement preview)"
  echo "  POST $API_BASE/api/v1/research/plans/:planId/insights {\"client_id\",\"insight_ids\"}"
  echo "  persist khtn_market_research_json keys: client_id|insight_ids|inserted_at|inserted_by"
  echo "  never copy statement/excerpt into plan JSON"
  echo "  client_mismatch → 400; insight_not_approved → 400; missing plan → 404 {error:not_found}"
  echo "  missing crm_mktplan.edit → 403 {error:forbidden} without title"
  echo "  cross-tenant GET → 403 {error:forbidden} without title"
  echo "  generic PATCH /api/crm/marketing-plans/:id ignores khtn_market_research_json"
  exit 0
fi

if [[ -z "${ACCESS_TOKEN:-}" || -z "${CLIENT_ID:-}" ]]; then
  echo "SKIP live P1 M3 insert insight — set ACCESS_TOKEN and CLIENT_ID"
  exit 0
fi

AUTH=( -H "Authorization: Bearer $ACCESS_TOKEN" -H "Content-Type: application/json" )

echo "==> GET /api/v1/research/insights?client_id=$CLIENT_ID"
HTTP_CODE="$(curl -sS -o /tmp/mr_p1_m3_list.json -w '%{http_code}' "${AUTH[@]}" \
  "$API_BASE/api/v1/research/insights?client_id=$CLIENT_ID")"
echo "http=$HTTP_CODE body=$(cat /tmp/mr_p1_m3_list.json)"
[[ "$HTTP_CODE" == "200" ]]

if [[ -z "${PLAN_ID:-}" ]]; then
  echo "SKIP live POST insert — set PLAN_ID to exercise freeze persist"
  echo "OK  market research P1 M3 smoke (list only)"
  exit 0
fi

IID="$(python3 -c "import json; rows=json.load(open('/tmp/mr_p1_m3_list.json')).get('insights') or []; print(rows[0]['id'] if rows else '')")"
if [[ -z "$IID" ]]; then
  echo "SKIP live POST insert — no approved insight for CLIENT_ID=$CLIENT_ID"
  exit 0
fi

echo "==> POST /api/v1/research/plans/$PLAN_ID/insights"
HTTP_CODE="$(curl -sS -o /tmp/mr_p1_m3_insert.json -w '%{http_code}' "${AUTH[@]}" \
  -X POST "$API_BASE/api/v1/research/plans/$PLAN_ID/insights" \
  -d "{\"client_id\":\"$CLIENT_ID\",\"insight_ids\":[$IID]}")"
echo "http=$HTTP_CODE body=$(cat /tmp/mr_p1_m3_insert.json)"
[[ "$HTTP_CODE" == "200" || "$HTTP_CODE" == "201" ]]
python3 - <<'PY'
import json
row=json.load(open('/tmp/mr_p1_m3_insert.json'))
snap=row.get('snapshot') or row
raw=json.dumps(snap)
assert 'statement' not in raw, row
assert 'excerpt' not in raw, row
assert snap.get('insight_ids'), row
print('OK  freeze snapshot ids', snap.get('insight_ids'))
PY

echo "OK  market research P1 M3 smoke"
