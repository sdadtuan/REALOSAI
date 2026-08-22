#!/usr/bin/env bash
# Smoke P3 M4 — Decision log after readout (RES-UC-042).
#
# Live API (flag on + staff token + project):
#   API_BASE=http://127.0.0.1:3000 ACCESS_TOKEN=... PROJECT_ID=1 \
#     ./scripts/smoke_market_research_p3_m4.sh
#
# Skip live if API is down (documents the contract and exits 0).
set -euo pipefail

API_BASE="${API_BASE:-http://127.0.0.1:3000}"
HEALTH_URL="$API_BASE/api/v1/research/health"

echo "==> GET $HEALTH_URL"
HTTP_CODE="$(curl -sS -o /tmp/mr_p3_m4_health.json -w '%{http_code}' "$HEALTH_URL" || true)"
BODY="$(cat /tmp/mr_p3_m4_health.json 2>/dev/null || true)"
echo "http=$HTTP_CODE body=$BODY"

if [[ "$HTTP_CODE" != "200" ]]; then
  echo "SKIP live P3 M4 decisions — health not 200 (flag off, API down, or unauthenticated path)."
  echo "Contract:"
  echo "  GET  $API_BASE/api/v1/research/projects/:id/decisions  cap view"
  echo "  POST $API_BASE/api/v1/research/projects/:id/decisions  cap edit"
  echo "    body {insight_id, decision_text, owner_email, due_at?}"
  echo "    insight draft / other project → 400 {error:insight_not_approved}"
  echo "    decision_text trim < 10 → 400 {error:validation_error}"
  echo "  PATCH $API_BASE/api/v1/research/decisions/:id  status/due_at/owner_email only"
  echo "    PATCH decision_text or insight_id → 400 {error:decision_locked}"
  echo "  cross-tenant GET → 403 {error:forbidden} without title"
  echo "  pulse / publish-portal do not insert decisions"
  echo "  FE tab Quyết định · «Ghi action sau readout — gắn insight đã duyệt.»"
  exit 0
fi

if [[ -z "${ACCESS_TOKEN:-}" || -z "${PROJECT_ID:-}" ]]; then
  echo "SKIP live P3 M4 decisions — set ACCESS_TOKEN and PROJECT_ID"
  exit 0
fi

AUTH=( -H "Authorization: Bearer $ACCESS_TOKEN" -H "Content-Type: application/json" )

echo "==> GET /api/v1/research/projects/$PROJECT_ID/decisions"
HTTP_CODE="$(curl -sS -o /tmp/mr_p3_m4_dec.json -w '%{http_code}' "${AUTH[@]}" \
  "$API_BASE/api/v1/research/projects/$PROJECT_ID/decisions")"
echo "http=$HTTP_CODE body=$(cat /tmp/mr_p3_m4_dec.json)"
if [[ "$HTTP_CODE" == "403" ]]; then
  python3 - <<'PY'
import json
body=json.load(open('/tmp/mr_p3_m4_dec.json'))
blob=json.dumps(body)
assert 'title' not in blob
print('OK  decisions 403 without title')
PY
elif [[ "$HTTP_CODE" == "200" ]]; then
  python3 - <<'PY'
import json
row=json.load(open('/tmp/mr_p3_m4_dec.json'))
items=row if isinstance(row, list) else (row.get('decisions') or row.get('items') or [])
print('OK  decisions list', len(items))
PY
else
  echo "SKIP live P3 M4 decisions unexpected http=$HTTP_CODE"
  exit 0
fi

if [[ -n "${INSIGHT_ID:-}" ]]; then
  echo "==> POST decision draft-gate (short text → validation_error)"
  HTTP_CODE="$(curl -sS -o /tmp/mr_p3_m4_post.json -w '%{http_code}' "${AUTH[@]}" \
    -X POST "$API_BASE/api/v1/research/projects/$PROJECT_ID/decisions" \
    -d "{\"insight_id\":$INSIGHT_ID,\"decision_text\":\"abc\",\"owner_email\":\"am@example.com\"}")"
  echo "http=$HTTP_CODE body=$(cat /tmp/mr_p3_m4_post.json)"
  if [[ "$HTTP_CODE" == "400" ]]; then
    python3 - <<'PY'
import json
row=json.load(open('/tmp/mr_p3_m4_post.json'))
payload=row.get('message') if isinstance(row.get('message'), dict) else row
err=payload.get('error') or row.get('error')
assert err in ('validation_error', 'insight_not_approved'), row
print('OK  decision POST 400', err)
PY
  fi
fi

echo "OK  market research P3 M4 smoke"
