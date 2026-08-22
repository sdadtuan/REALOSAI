#!/usr/bin/env bash
# Smoke P2 M4 — Market Research OS: ops analytics cycle time / completeness.
#
# Live API (flag on + staff token):
#   API_BASE=http://127.0.0.1:3000 ACCESS_TOKEN=... \
#     ./scripts/smoke_market_research_p2_m4.sh
#
# Skip live if API is down (documents the contract and exits 0).
set -euo pipefail

API_BASE="${API_BASE:-http://127.0.0.1:3000}"
HEALTH_URL="$API_BASE/api/v1/research/health"

echo "==> GET $HEALTH_URL"
HTTP_CODE="$(curl -sS -o /tmp/mr_p2_m4_health.json -w '%{http_code}' "$HEALTH_URL" || true)"
BODY="$(cat /tmp/mr_p2_m4_health.json 2>/dev/null || true)"
echo "http=$HTTP_CODE body=$BODY"

if [[ "$HTTP_CODE" != "200" ]]; then
  echo "SKIP live P2 M4 analytics — health not 200 (flag off, API down, or unauthenticated path)."
  echo "Contract:"
  echo "  GET $API_BASE/api/v1/research/analytics/ops cap view"
  echo "  payload: cycle_time_hours / evidence_completeness / activation + projects[]"
  echo "  project rows: id, client_id, status, verified_ev — never title"
  echo "  out-of-scope client_id → 403 {error:forbidden} without title"
  echo "  FE /crm/research/analytics · OpsNav «Phân tích nghiên cứu»"
  echo "  scoped list omits projects outside allowedClientIds"
  exit 0
fi

if [[ -z "${ACCESS_TOKEN:-}" ]]; then
  echo "SKIP live P2 M4 analytics — set ACCESS_TOKEN"
  exit 0
fi

AUTH=( -H "Authorization: Bearer $ACCESS_TOKEN" -H "Content-Type: application/json" )

echo "==> GET /api/v1/research/analytics/ops"
HTTP_CODE="$(curl -sS -o /tmp/mr_p2_m4_ops.json -w '%{http_code}' "${AUTH[@]}" \
  "$API_BASE/api/v1/research/analytics/ops")"
echo "http=$HTTP_CODE body=$(cat /tmp/mr_p2_m4_ops.json)"
[[ "$HTTP_CODE" == "200" ]]
python3 - <<'PY'
import json
row=json.load(open('/tmp/mr_p2_m4_ops.json'))
assert 'cycle_time_hours' in row, row
assert 'evidence_completeness' in row, row
assert 'activation' in row, row
blob=json.dumps(row)
for p in row.get('projects') or []:
    assert 'title' not in p, p
    assert set(p.keys()) <= {'id', 'client_id', 'status', 'verified_ev'} or 'title' not in p
print('OK  analytics/ops keys+', len(row.get('projects') or []))
PY

if [[ -n "${BETA_TOKEN:-}" ]]; then
  echo "==> GET /analytics/ops?client_id=acme as beta (expect 403 no title)"
  HTTP_CODE="$(curl -sS -o /tmp/mr_p2_m4_tenancy.json -w '%{http_code}' \
    -H "Authorization: Bearer $BETA_TOKEN" \
    "$API_BASE/api/v1/research/analytics/ops?client_id=acme" || true)"
  echo "http=$HTTP_CODE body=$(cat /tmp/mr_p2_m4_tenancy.json 2>/dev/null || true)"
  [[ "$HTTP_CODE" == "403" ]]
  python3 - <<'PY'
import json
body=json.load(open('/tmp/mr_p2_m4_tenancy.json'))
blob=json.dumps(body)
assert body.get('error')=='forbidden' or (isinstance(body.get('message'), dict) and body['message'].get('error')=='forbidden'), body
assert 'title' not in blob
print('OK  analytics 403 without title')
PY
fi

echo "OK  market research P2 M4 smoke"
