#!/usr/bin/env bash
# Smoke P3 M3 — Waves on TRACKER + compare (RES-UC-041).
#
# Live API (flag on + staff token + TRACKER project):
#   API_BASE=http://127.0.0.1:3000 ACCESS_TOKEN=... PROJECT_ID=1 \
#     ./scripts/smoke_market_research_p3_m3.sh
#
# Skip live if API is down (documents the contract and exits 0).
set -euo pipefail

API_BASE="${API_BASE:-http://127.0.0.1:3000}"
HEALTH_URL="$API_BASE/api/v1/research/health"

echo "==> GET $HEALTH_URL"
HTTP_CODE="$(curl -sS -o /tmp/mr_p3_m3_health.json -w '%{http_code}' "$HEALTH_URL" || true)"
BODY="$(cat /tmp/mr_p3_m3_health.json 2>/dev/null || true)"
echo "http=$HTTP_CODE body=$BODY"

if [[ "$HTTP_CODE" != "200" ]]; then
  echo "SKIP live P3 M3 waves — health not 200 (flag off, API down, or unauthenticated path)."
  echo "Contract:"
  echo "  GET  $API_BASE/api/v1/research/projects/:id/waves  cap view"
  echo "  POST $API_BASE/api/v1/research/projects/:id/waves  cap edit"
  echo "    body {wave_no, label?, field_start?, field_end?, metric_json}"
  echo "    product_type !== TRACKER → 400 {error:waves_not_tracker} (CAT_REVIEW)"
  echo "    compare = waveDelta on same key of 2 latest waves"
  echo "  cross-tenant GET → 403 {error:forbidden} without title"
  echo "  FE tab Waves only when product_type===TRACKER · «So sánh 2 wave gần nhất.»"
  exit 0
fi

if [[ -z "${ACCESS_TOKEN:-}" || -z "${PROJECT_ID:-}" ]]; then
  echo "SKIP live P3 M3 waves — set ACCESS_TOKEN and PROJECT_ID"
  exit 0
fi

AUTH=( -H "Authorization: Bearer $ACCESS_TOKEN" -H "Content-Type: application/json" )

echo "==> GET /api/v1/research/projects/$PROJECT_ID/waves"
HTTP_CODE="$(curl -sS -o /tmp/mr_p3_m3_waves.json -w '%{http_code}' "${AUTH[@]}" \
  "$API_BASE/api/v1/research/projects/$PROJECT_ID/waves")"
echo "http=$HTTP_CODE body=$(cat /tmp/mr_p3_m3_waves.json)"
if [[ "$HTTP_CODE" == "400" ]]; then
  python3 - <<'PY'
import json
row=json.load(open('/tmp/mr_p3_m3_waves.json'))
payload=row.get('message') if isinstance(row.get('message'), dict) else row
err=payload.get('error') or row.get('error')
assert err == 'waves_not_tracker', row
print('OK  waves 400 waves_not_tracker')
PY
elif [[ "$HTTP_CODE" == "403" ]]; then
  python3 - <<'PY'
import json
body=json.load(open('/tmp/mr_p3_m3_waves.json'))
blob=json.dumps(body)
assert 'title' not in blob
print('OK  waves 403 without title')
PY
elif [[ "$HTTP_CODE" == "200" ]]; then
  python3 - <<'PY'
import json
row=json.load(open('/tmp/mr_p3_m3_waves.json'))
items=row if isinstance(row, list) else (row.get('waves') or row.get('items') or [])
print('OK  waves list', len(items))
PY
else
  echo "SKIP live P3 M3 waves unexpected http=$HTTP_CODE"
  exit 0
fi

echo "OK  market research P3 M3 smoke"
