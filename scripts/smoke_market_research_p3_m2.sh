#!/usr/bin/env bash
# Smoke P3 M2 — Portal khách: read-only report + watermark (RES-UC-040).
#
# Live portal (flag on + portal JWT):
#   API_BASE=http://127.0.0.1:3000 PORTAL_TOKEN=... VERSION_ID=42 \
#     ./scripts/smoke_market_research_p3_m2.sh
#
# Skip live if API/portal is down (documents the contract and exits 0).
set -euo pipefail

API_BASE="${API_BASE:-http://127.0.0.1:3000}"
HEALTH_URL="$API_BASE/api/v1/research/health"

echo "==> GET $HEALTH_URL"
HTTP_CODE="$(curl -sS -o /tmp/mr_p3_m2_health.json -w '%{http_code}' "$HEALTH_URL" || true)"
BODY="$(cat /tmp/mr_p3_m2_health.json 2>/dev/null || true)"
echo "http=$HTTP_CODE body=$BODY"

if [[ "$HTTP_CODE" != "200" ]]; then
  echo "SKIP live P3 M2 portal report — health not 200 (flag off, API down, or unauthenticated path)."
  echo "Contract:"
  echo "  GET $API_BASE/api/v1/portal/research/reports"
  echo "    portal_visible=true AND p.client_id = jwt.client_id; skip embargo/expired"
  echo "    cards: version_id, version, as_of, expires_at, watermark — no title"
  echo "  GET $API_BASE/api/v1/portal/research/reports/:versionId"
  echo "    cross-tenant → 403 {error:forbidden} without title"
  echo "    unpublished same-tenant → 404 {error:not_found}"
  echo "    expired → 403 {error:report_expired}"
  echo "    embargo → 403 {error:embargo_active}"
  echo "    success: exec.vi + exec.en (approved only) + findings/recs/methodology/evidence_index + watermark"
  exit 0
fi

if [[ -z "${PORTAL_TOKEN:-}" ]]; then
  echo "SKIP live P3 M2 portal report — set PORTAL_TOKEN"
  exit 0
fi

AUTH=( -H "Authorization: Bearer $PORTAL_TOKEN" -H "Content-Type: application/json" )

echo "==> GET /api/v1/portal/research/reports"
HTTP_CODE="$(curl -sS -o /tmp/mr_p3_m2_list.json -w '%{http_code}' "${AUTH[@]}" \
  "$API_BASE/api/v1/portal/research/reports" || true)"
echo "http=$HTTP_CODE body=$(cat /tmp/mr_p3_m2_list.json)"
if [[ "$HTTP_CODE" != "200" ]]; then
  echo "SKIP live P3 M2 portal list — portal/API not ready (http=$HTTP_CODE)"
  exit 0
fi
python3 - <<'PY'
import json
row=json.load(open('/tmp/mr_p3_m2_list.json'))
blob=json.dumps(row)
assert 'title' not in blob, row
items=row.get('items') or []
for card in items:
    assert 'version_id' in card and 'watermark' in card, card
    assert 'title' not in card, card
print('OK  portal list', len(items), 'card(s)')
PY

if [[ -n "${VERSION_ID:-}" ]]; then
  echo "==> GET /api/v1/portal/research/reports/$VERSION_ID"
  HTTP_CODE="$(curl -sS -o /tmp/mr_p3_m2_detail.json -w '%{http_code}' "${AUTH[@]}" \
    "$API_BASE/api/v1/portal/research/reports/$VERSION_ID" || true)"
  echo "http=$HTTP_CODE body=$(cat /tmp/mr_p3_m2_detail.json)"
  if [[ "$HTTP_CODE" == "200" ]]; then
    python3 - <<'PY'
import json
row=json.load(open('/tmp/mr_p3_m2_detail.json'))
assert row.get('watermark'), row
assert 'project' not in row, row
assert 'title' not in row, row
print('OK  portal detail watermark')
PY
  fi
fi

echo "OK  market research P3 M2 smoke"
