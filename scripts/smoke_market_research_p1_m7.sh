#!/usr/bin/env bash
# Smoke P1 M7 — Market Research OS: consult prefill (phone stripped).
#
# Live API (flag on + staff token):
#   API_BASE=http://127.0.0.1:3000 ACCESS_TOKEN=... CLIENT_ID=acme \
#     ./scripts/smoke_market_research_p1_m7.sh
#
# Skip live if API is down (documents the contract and exits 0).
set -euo pipefail

API_BASE="${API_BASE:-http://127.0.0.1:3000}"
HEALTH_URL="$API_BASE/api/v1/research/health"

echo "==> GET $HEALTH_URL"
HTTP_CODE="$(curl -sS -o /tmp/mr_p1_m7_health.json -w '%{http_code}' "$HEALTH_URL" || true)"
BODY="$(cat /tmp/mr_p1_m7_health.json 2>/dev/null || true)"
echo "http=$HTTP_CODE body=$BODY"

if [[ "$HTTP_CODE" != "200" ]]; then
  echo "SKIP live P1 M7 prefill — health not 200 (flag off, API down, or unauthenticated path)."
  echo "Contract:"
  echo "  GET $API_BASE/api/v1/research/prefill?client_id=CLIENT_ID"
  echo "    cap create; 200 never 404"
  echo "    no consult → { industry: null, competitor_names: [], suggested_rqs: [] }"
  echo "    form containing 0909… → JSON does not contain that number"
  echo "    allowed keys only: industry/niche + competitors (split ; / ,)"
  echo "  POST $API_BASE/api/v1/research/projects"
  echo "    optional prefill_competitors?: string[] → draft competitors name-only (no snapshot)"
  echo "  Wizard bước 1 chips «Dùng gợi ý» / «Bỏ» per industry and per competitor"
  exit 0
fi

if [[ -z "${ACCESS_TOKEN:-}" || -z "${CLIENT_ID:-}" ]]; then
  echo "SKIP live P1 M7 prefill — set ACCESS_TOKEN and CLIENT_ID"
  exit 0
fi

AUTH=( -H "Authorization: Bearer $ACCESS_TOKEN" -H "Content-Type: application/json" )

echo "==> GET /api/v1/research/prefill?client_id=$CLIENT_ID"
HTTP_CODE="$(curl -sS -o /tmp/mr_p1_m7_prefill.json -w '%{http_code}' "${AUTH[@]}" \
  "$API_BASE/api/v1/research/prefill?client_id=$CLIENT_ID")"
echo "http=$HTTP_CODE body=$(cat /tmp/mr_p1_m7_prefill.json)"
if [[ "$HTTP_CODE" != "200" ]]; then
  echo "SKIP live P1 M7 prefill — unexpected status $HTTP_CODE"
  exit 0
fi

python3 - <<'PY'
import json
body=json.load(open('/tmp/mr_p1_m7_prefill.json'))
assert 'industry' in body, body
assert isinstance(body.get('competitor_names'), list), body
assert isinstance(body.get('suggested_rqs'), list), body
blob=json.dumps(body)
assert '0909' not in blob, body
print('OK  prefill shape + no 0909 token')
PY

echo "OK  market research P1 M7 smoke"
