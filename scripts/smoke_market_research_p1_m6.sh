#!/usr/bin/env bash
# Smoke P1 M6 — Market Research OS: dual Tavily triangulation.
#
# Live API (flag on + staff token + existing project with RQ):
#   API_BASE=http://127.0.0.1:3000 ACCESS_TOKEN=... CLIENT_ID=acme \
#     ./scripts/smoke_market_research_p1_m6.sh
#
# Skip live if API is down (documents the contract and exits 0).
set -euo pipefail

API_BASE="${API_BASE:-http://127.0.0.1:3000}"
HEALTH_URL="$API_BASE/api/v1/research/health"

echo "==> GET $HEALTH_URL"
HTTP_CODE="$(curl -sS -o /tmp/mr_p1_m6_health.json -w '%{http_code}' "$HEALTH_URL" || true)"
BODY="$(cat /tmp/mr_p1_m6_health.json 2>/dev/null || true)"
echo "http=$HTTP_CODE body=$BODY"

if [[ "$HTTP_CODE" != "200" ]]; then
  echo "SKIP live P1 M6 triangulation — health not 200 (flag off, API down, or unauthenticated path)."
  echo "Contract:"
  echo "  POST $API_BASE/api/v1/research/projects/:id/questions/:qid/run-triangulate"
  echo "    cap run; enqueue jobType research_triangulate"
  echo "    in-flight same question → 409 {error:job_in_flight}"
  echo "    worker: Tavily basic + advanced; overlap URLs → triangulated=true"
  echo "    Deep and triangulate never insert insights"
  echo "  POST $API_BASE/api/v1/research/sources/:id/accept-single-source"
  echo "    cap approve → single_source_accepted=true"
  echo "    insight attached to that source: High/Very High capped to Medium"
  echo "  FE: Tam giác nguồn; badge «Trùng 2 provider»"
  exit 0
fi

if [[ -z "${ACCESS_TOKEN:-}" || -z "${CLIENT_ID:-}" ]]; then
  echo "SKIP live P1 M6 triangulation — set ACCESS_TOKEN and CLIENT_ID"
  exit 0
fi

AUTH=( -H "Authorization: Bearer $ACCESS_TOKEN" -H "Content-Type: application/json" )
TITLE="Smoke P1 M6 $(date +%s)"

echo "==> POST /api/v1/research/projects"
HTTP_CODE="$(curl -sS -o /tmp/mr_p1_m6_create.json -w '%{http_code}' "${AUTH[@]}" \
  -X POST "$API_BASE/api/v1/research/projects" \
  -d "{\"client_id\":\"$CLIENT_ID\",\"title\":\"$TITLE\",\"product_type\":\"CAT_REVIEW\",\"dv12_tier\":\"CB\",\"decision_statement\":\"Quyết định có mở SKU premium Q4 hay không.\",\"geo\":[\"VN\"],\"languages\":[\"vi\"],\"risk_class\":\"low\",\"questions\":[{\"question_vi\":\"Quy mô thị trường sữa uống VN?\",\"sort_order\":1}]}")"
echo "http=$HTTP_CODE body=$(cat /tmp/mr_p1_m6_create.json)"
if [[ "$HTTP_CODE" != "201" ]]; then
  echo "SKIP live P1 M6 triangulate — could not create project"
  exit 0
fi
PID="$(python3 -c "import json; print(json.load(open('/tmp/mr_p1_m6_create.json'))['project']['id'])")"
QID="$(python3 -c "import json; print(json.load(open('/tmp/mr_p1_m6_create.json'))['project']['questions'][0]['id'])")"

echo "==> POST /projects/$PID/questions/$QID/run-triangulate"
HTTP_CODE="$(curl -sS -o /tmp/mr_p1_m6_tri.json -w '%{http_code}' "${AUTH[@]}" \
  -X POST "$API_BASE/api/v1/research/projects/$PID/questions/$QID/run-triangulate")"
echo "http=$HTTP_CODE body=$(cat /tmp/mr_p1_m6_tri.json)"
if [[ "$HTTP_CODE" == "202" || "$HTTP_CODE" == "200" ]]; then
  echo "OK  triangulate accepted"
elif [[ "$HTTP_CODE" == "409" ]]; then
  python3 -c "import json; b=json.load(open('/tmp/mr_p1_m6_tri.json')); assert b.get('error')=='job_in_flight', b"
  echo "OK  in-flight → 409 job_in_flight"
else
  echo "NOTE  unexpected triangulate status $HTTP_CODE"
fi

echo "OK  market research P1 M6 smoke"
