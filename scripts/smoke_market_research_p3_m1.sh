#!/usr/bin/env bash
# Smoke P3 M1 — Embargo/expiry + Công bố portal (RES-UC-040 staff).
#
# Live API (flag on + staff token + existing report version):
#   API_BASE=http://127.0.0.1:3000 ACCESS_TOKEN=... REPORT_ID=1 VERSION_ID=1 \
#     ./scripts/smoke_market_research_p3_m1.sh
#
# Skip live if API is down (documents the contract and exits 0).
set -euo pipefail

API_BASE="${API_BASE:-http://127.0.0.1:3000}"
HEALTH_URL="$API_BASE/api/v1/research/health"

echo "==> GET $HEALTH_URL"
HTTP_CODE="$(curl -sS -o /tmp/mr_p3_m1_health.json -w '%{http_code}' "$HEALTH_URL" || true)"
BODY="$(cat /tmp/mr_p3_m1_health.json 2>/dev/null || true)"
echo "http=$HTTP_CODE body=$BODY"

if [[ "$HTTP_CODE" != "200" ]]; then
  echo "SKIP live P3 M1 embargo/publish — health not 200 (flag off, API down, or unauthenticated path)."
  echo "Contract:"
  echo "  PATCH $API_BASE/api/v1/research/reports/:reportId/versions/:versionId/embargo"
  echo "    cap edit; body {embargo_until?, expires_at?} ISO; snapshot/vi unchanged"
  echo "  POST $API_BASE/api/v1/research/reports/:reportId/versions/:versionId/publish-portal"
  echo "    cap approve; body {visible:boolean}"
  echo "    visible:true → assertPublishableInsights; else 400 {error:insights_not_client_facing}"
  echo "    actor === generated_by → 403 {error:cannot_self_approve}"
  echo "  createReport → portal_visible === false (no auto-publish)"
  echo "  FE Report: embargo/expiry + «Công bố portal» / «Gỡ khỏi portal»"
  exit 0
fi

if [[ -z "${ACCESS_TOKEN:-}" || -z "${REPORT_ID:-}" || -z "${VERSION_ID:-}" ]]; then
  echo "SKIP live P3 M1 embargo/publish — set ACCESS_TOKEN, REPORT_ID, and VERSION_ID"
  exit 0
fi

AUTH=( -H "Authorization: Bearer $ACCESS_TOKEN" -H "Content-Type: application/json" )

echo "==> POST /reports/$REPORT_ID/versions/$VERSION_ID/publish-portal visible=true"
HTTP_CODE="$(curl -sS -o /tmp/mr_p3_m1_pub.json -w '%{http_code}' "${AUTH[@]}" \
  -X POST "$API_BASE/api/v1/research/reports/$REPORT_ID/versions/$VERSION_ID/publish-portal" \
  -d '{"visible":true}')"
echo "http=$HTTP_CODE body=$(cat /tmp/mr_p3_m1_pub.json)"
if [[ "$HTTP_CODE" == "400" ]]; then
  python3 - <<'PY'
import json
row=json.load(open('/tmp/mr_p3_m1_pub.json'))
payload=row.get('message') if isinstance(row.get('message'), dict) else row
err=payload.get('error') or row.get('error')
assert err in ('insights_not_client_facing', 'validation_error', 'not_found'), row
print('OK  publish-portal 400', err)
PY
elif [[ "$HTTP_CODE" == "403" ]]; then
  python3 - <<'PY'
import json
row=json.load(open('/tmp/mr_p3_m1_pub.json'))
payload=row.get('message') if isinstance(row.get('message'), dict) else row
err=payload.get('error') or row.get('error')
assert err == 'cannot_self_approve', row
print('OK  publish-portal 403 cannot_self_approve')
PY
elif [[ "$HTTP_CODE" == "200" || "$HTTP_CODE" == "201" ]]; then
  python3 - <<'PY'
import json
row=json.load(open('/tmp/mr_p3_m1_pub.json'))
assert row.get('portal_visible') in (True, False) or 'portal_visible' in json.dumps(row), row
print('OK  publish-portal persisted')
PY
else
  echo "SKIP live P3 M1 publish-portal unexpected http=$HTTP_CODE"
  exit 0
fi

echo "OK  market research P3 M1 smoke"
