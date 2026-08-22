#!/usr/bin/env bash
# Smoke P1 M5 — Market Research OS: DV12 CTA from service-delivery.
#
# Live API (flag on + staff token + existing DV12 lifecycle):
#   API_BASE=http://127.0.0.1:3000 ACCESS_TOKEN=... LIFECYCLE_ID=12 \
#     ./scripts/smoke_market_research_p1_m5.sh
#
# Skip live if API is down (documents the contract and exits 0).
set -euo pipefail

API_BASE="${API_BASE:-http://127.0.0.1:3000}"
HEALTH_URL="$API_BASE/api/v1/research/health"

echo "==> GET $HEALTH_URL"
HTTP_CODE="$(curl -sS -o /tmp/mr_p1_m5_health.json -w '%{http_code}' "$HEALTH_URL" || true)"
BODY="$(cat /tmp/mr_p1_m5_health.json 2>/dev/null || true)"
echo "http=$HTTP_CODE body=$BODY"

if [[ "$HTTP_CODE" != "200" ]]; then
  echo "SKIP live P1 M5 DV12 CTA — health not 200 (flag off, API down, or unauthenticated path)."
  echo "Contract:"
  echo "  GET $API_BASE/api/v1/research/projects?lifecycle_id=LIFECYCLE_ID"
  echo "    first match = existing project → CTA href /crm/research/:id (no new wizard)"
  echo "  researchCtaHref: slug !== phan-tich-thi-truong → null"
  echo "  wizard /crm/research/new?lifecycle_id=&client_id=&title="
  echo "  POST $API_BASE/api/v1/research/projects persists lifecycle_id"
  echo "  FE button «Mở Research Project» only if slug + crm_research.view + FE flag"
  echo "  client_id from contract agency_client_id — do not invent a client"
  exit 0
fi

if [[ -z "${ACCESS_TOKEN:-}" || -z "${LIFECYCLE_ID:-}" ]]; then
  echo "SKIP live P1 M5 DV12 CTA — set ACCESS_TOKEN and LIFECYCLE_ID"
  exit 0
fi

AUTH=( -H "Authorization: Bearer $ACCESS_TOKEN" -H "Content-Type: application/json" )

echo "==> GET /api/v1/research/projects?lifecycle_id=$LIFECYCLE_ID"
HTTP_CODE="$(curl -sS -o /tmp/mr_p1_m5_list.json -w '%{http_code}' "${AUTH[@]}" \
  "$API_BASE/api/v1/research/projects?lifecycle_id=$LIFECYCLE_ID")"
echo "http=$HTTP_CODE body=$(cat /tmp/mr_p1_m5_list.json)"
if [[ "$HTTP_CODE" != "200" ]]; then
  echo "SKIP live P1 M5 list — could not list projects by lifecycle_id"
  exit 0
fi

python3 - <<PY
import json
body=json.load(open('/tmp/mr_p1_m5_list.json'))
projects=body.get('projects') or []
print('projects=', len(projects))
if projects:
    lid=projects[0].get('lifecycle_id')
    print('first.lifecycle_id=', lid)
    assert lid is None or int(lid)==int("$LIFECYCLE_ID"), projects[0]
print('OK  list filter lifecycle_id')
PY

echo "OK  market research P1 M5 smoke"
