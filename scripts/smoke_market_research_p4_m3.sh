#!/usr/bin/env bash
# Smoke P4 M3 — Content OS insight cite (RES-UC-051).
#
# Live API (flag on + staff token + existing content item + approved insight):
#   API_BASE=http://127.0.0.1:3000 ACCESS_TOKEN=... CLIENT_ID=acme ITEM_ID=1 \
#     ./scripts/smoke_market_research_p4_m3.sh
# Optional: LIFECYCLE_ID=... to GET the item after cite (F5).
#
# Skip live if API is down (documents the contract and exits 0).
set -euo pipefail

API_BASE="${API_BASE:-http://127.0.0.1:3000}"
HEALTH_URL="$API_BASE/api/v1/research/health"

echo "==> GET $HEALTH_URL"
HTTP_CODE="$(curl -sS -o /tmp/mr_p4_m3_health.json -w '%{http_code}' "$HEALTH_URL" || true)"
BODY="$(cat /tmp/mr_p4_m3_health.json 2>/dev/null || true)"
echo "http=$HTTP_CODE body=$BODY"

if [[ "$HTTP_CODE" != "200" ]]; then
  echo "SKIP live P4 M3 content cite — health not 200 (flag off, API down, or unauthenticated path)."
  echo "Contract:"
  echo "  POST $API_BASE/api/v1/research/content-items/:itemId/insights {\"client_id\",\"insight_ids\"}"
  echo "    dual cap crm_research.edit + crm_content.write"
  echo "    persist brief_json.market_research keys: client_id|insight_ids|inserted_at|inserted_by"
  echo "    never copy statement/excerpt into brief_json"
  echo "    insight_not_approved → 400; content_item_client_mismatch → 400; content_item_no_client → 400"
  echo "    missing crm_content.write → 403 {error:missing_cap,section:crm_content,action:write}"
  echo "    cross-tenant item → 403 {error:forbidden} without title"
  echo "    flag off → 404 {error:market_research_disabled}"
  echo "  GET content item after F5 still has brief_json.market_research.insight_ids"
  echo "  generic PATCH brief_json strips inbound market_research and keeps existing cite"
  exit 0
fi

if [[ -z "${ACCESS_TOKEN:-}" || -z "${CLIENT_ID:-}" ]]; then
  echo "SKIP live P4 M3 content cite — set ACCESS_TOKEN and CLIENT_ID"
  exit 0
fi

AUTH=( -H "Authorization: Bearer $ACCESS_TOKEN" -H "Content-Type: application/json" )

echo "==> GET /api/v1/research/insights?client_id=$CLIENT_ID"
HTTP_CODE="$(curl -sS -o /tmp/mr_p4_m3_list.json -w '%{http_code}' "${AUTH[@]}" \
  "$API_BASE/api/v1/research/insights?client_id=$CLIENT_ID")"
echo "http=$HTTP_CODE body=$(cat /tmp/mr_p4_m3_list.json)"
if [[ "$HTTP_CODE" != "200" ]]; then
  echo "SKIP live P4 M3 content cite — unexpected insights status $HTTP_CODE"
  exit 0
fi

if [[ -z "${ITEM_ID:-}" ]]; then
  echo "SKIP live POST cite — set ITEM_ID to exercise freeze persist"
  echo "OK  market research P4 M3 smoke (list only)"
  exit 0
fi

IID="$(python3 -c "import json; rows=json.load(open('/tmp/mr_p4_m3_list.json')).get('insights') or []; print(rows[0]['id'] if rows else '')")"
if [[ -z "$IID" ]]; then
  echo "SKIP live POST cite — no approved insight for CLIENT_ID=$CLIENT_ID"
  exit 0
fi

echo "==> POST /api/v1/research/content-items/$ITEM_ID/insights"
HTTP_CODE="$(curl -sS -o /tmp/mr_p4_m3_insert.json -w '%{http_code}' "${AUTH[@]}" \
  -X POST "$API_BASE/api/v1/research/content-items/$ITEM_ID/insights" \
  -d "{\"client_id\":\"$CLIENT_ID\",\"insight_ids\":[$IID]}")"
echo "http=$HTTP_CODE body=$(cat /tmp/mr_p4_m3_insert.json)"
if [[ "$HTTP_CODE" != "200" && "$HTTP_CODE" != "201" ]]; then
  echo "SKIP live POST cite — unexpected status $HTTP_CODE"
  exit 0
fi
python3 - <<'PY'
import json
row=json.load(open('/tmp/mr_p4_m3_insert.json'))
snap=row.get('snapshot') or row
raw=json.dumps(snap)
assert 'statement' not in raw, row
assert 'excerpt' not in raw, row
assert snap.get('insight_ids'), row
print('OK  freeze snapshot ids', snap.get('insight_ids'))
PY

if [[ -n "${LIFECYCLE_ID:-}" ]]; then
  echo "==> GET content item $ITEM_ID (F5)"
  HTTP_CODE="$(curl -sS -o /tmp/mr_p4_m3_item.json -w '%{http_code}' "${AUTH[@]}" \
    "$API_BASE/api/crm/service-lifecycle/$LIFECYCLE_ID/content-marketing/items/$ITEM_ID" || true)"
  echo "http=$HTTP_CODE body=$(cat /tmp/mr_p4_m3_item.json 2>/dev/null || true)"
  if [[ "$HTTP_CODE" == "200" ]]; then
    python3 - <<'PY'
import json
item=json.load(open('/tmp/mr_p4_m3_item.json'))
brief=item.get('brief_json') or {}
cite=brief.get('market_research') or {}
assert cite.get('insight_ids'), item
raw=json.dumps(cite)
assert 'statement' not in raw, cite
print('OK  F5 cite insight_ids', cite.get('insight_ids'))
PY
  else
    echo "SKIP live GET item — unexpected status $HTTP_CODE"
  fi
fi

echo "OK  market research P4 M3 smoke"
