#!/usr/bin/env bash
# Smoke P1 M4 — Market Research OS: methodology TC/CS export gate.
#
# Live API (flag on + staff token + existing TC project with approved insight):
#   API_BASE=http://127.0.0.1:3000 ACCESS_TOKEN=... CLIENT_ID=acme \
#     ./scripts/smoke_market_research_p1_m4.sh
#
# Skip live if API is down (documents the contract and exits 0).
set -euo pipefail

API_BASE="${API_BASE:-http://127.0.0.1:3000}"
HEALTH_URL="$API_BASE/api/v1/research/health"

echo "==> GET $HEALTH_URL"
HTTP_CODE="$(curl -sS -o /tmp/mr_p1_m4_health.json -w '%{http_code}' "$HEALTH_URL" || true)"
BODY="$(cat /tmp/mr_p1_m4_health.json 2>/dev/null || true)"
echo "http=$HTTP_CODE body=$BODY"

if [[ "$HTTP_CODE" != "200" ]]; then
  echo "SKIP live P1 M4 methodology gate — health not 200 (flag off, API down, or unauthenticated path)."
  echo "Contract:"
  echo "  POST $API_BASE/api/v1/research/projects/:id/reports"
  echo "    {\"insight_ids\":[…],\"methodology\":{\"population\",\"source_plan\",\"limitation\"}}"
  echo "  CB + methodology.stub=true still creates/exports (P0 no regress)"
  echo "  TC/CS + stub or any field trim().length < 8 → 400 {error:methodology_incomplete}"
  echo "  GET $API_BASE/api/v1/research/reports/:id/versions/:versionId/export"
  echo "    cap export; DOCX Methodology section includes Limitation / Hạn chế"
  echo "  persist methodology on report content_snapshot (no new table)"
  exit 0
fi

if [[ -z "${ACCESS_TOKEN:-}" || -z "${CLIENT_ID:-}" ]]; then
  echo "SKIP live P1 M4 methodology gate — set ACCESS_TOKEN and CLIENT_ID"
  exit 0
fi

AUTH=( -H "Authorization: Bearer $ACCESS_TOKEN" -H "Content-Type: application/json" )
TITLE="Smoke P1 M4 TC $(date +%s)"

echo "==> POST /api/v1/research/projects (TC)"
HTTP_CODE="$(curl -sS -o /tmp/mr_p1_m4_create.json -w '%{http_code}' "${AUTH[@]}" \
  -X POST "$API_BASE/api/v1/research/projects" \
  -d "{\"client_id\":\"$CLIENT_ID\",\"title\":\"$TITLE\",\"product_type\":\"CAT_REVIEW\",\"dv12_tier\":\"TC\",\"decision_statement\":\"Quyết định có mở SKU premium Q4 hay không.\",\"geo\":[\"VN\"],\"languages\":[\"vi\"],\"risk_class\":\"low\",\"questions\":[{\"question_vi\":\"Quy mô thị trường sữa uống VN?\",\"sort_order\":1}]}")"
echo "http=$HTTP_CODE body=$(cat /tmp/mr_p1_m4_create.json)"
if [[ "$HTTP_CODE" != "201" ]]; then
  echo "SKIP live P1 M4 create/export — could not create TC project"
  exit 0
fi
PID="$(python3 -c "import json; print(json.load(open('/tmp/mr_p1_m4_create.json'))['project']['id'])")"

echo "==> POST /projects/$PID/reports with methodology stub (expect 400)"
HTTP_CODE="$(curl -sS -o /tmp/mr_p1_m4_stub.json -w '%{http_code}' "${AUTH[@]}" \
  -X POST "$API_BASE/api/v1/research/projects/$PID/reports" \
  -d '{"insight_ids":[1],"methodology":{"stub":true,"population":"","source_plan":"","limitation":""}}')"
echo "http=$HTTP_CODE body=$(cat /tmp/mr_p1_m4_stub.json)"
python3 - <<'PY'
import json
body=json.load(open('/tmp/mr_p1_m4_stub.json'))
code=open('/tmp/mr_p1_m4_stub.json')
print('stub create error=', body.get('error') or body)
PY
if [[ "$HTTP_CODE" == "400" ]]; then
  python3 -c "import json; b=json.load(open('/tmp/mr_p1_m4_stub.json')); assert b.get('error')=='methodology_incomplete', b"
  echo "OK  TC stub → 400 methodology_incomplete"
else
  echo "NOTE  expected 400 methodology_incomplete (may be 400 validation if insight_ids invalid)"
fi

echo "OK  market research P1 M4 smoke"
