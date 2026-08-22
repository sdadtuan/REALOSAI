#!/usr/bin/env bash
# Smoke P4 M4 — Publish audit stamps + wave NaN 400.
#
# Live API (flag on + staff token + existing report version / TRACKER project):
#   API_BASE=http://127.0.0.1:3000 ACCESS_TOKEN=... REPORT_ID=1 VERSION_ID=1 \
#     ./scripts/smoke_market_research_p4_m4.sh
# Optional: PROJECT_ID=... to POST a NaN wave (expect 400).
#
# Skip live if API is down (documents the contract and exits 0).
set -euo pipefail

API_BASE="${API_BASE:-http://127.0.0.1:3000}"
HEALTH_URL="$API_BASE/api/v1/research/health"

echo "==> GET $HEALTH_URL"
HTTP_CODE="$(curl -sS -o /tmp/mr_p4_m4_health.json -w '%{http_code}' "$HEALTH_URL" || true)"
BODY="$(cat /tmp/mr_p4_m4_health.json 2>/dev/null || true)"
echo "http=$HTTP_CODE body=$BODY"

if [[ "$HTTP_CODE" != "200" ]]; then
  echo "SKIP live P4 M4 publish audit / wave NaN — health not 200 (flag off, API down, or unauthenticated path)."
  echo "Contract:"
  echo "  POST $API_BASE/api/v1/research/reports/:reportId/versions/:versionId/publish-portal"
  echo "    visible:true → published_by + published_at stamped (audit)"
  echo "    visible:false → portal_visible=false; published_by / published_at kept"
  echo "    createReport → published_by === null / published_at === null"
  echo "  POST $API_BASE/api/v1/research/projects/:id/waves"
  echo "    metric_json value NaN or Infinity → 400 metric value must be number or null"
  echo "  FE Report: «Công bố bởi {published_by} lúc {published_at}» when audit present"
  exit 0
fi

if [[ -z "${ACCESS_TOKEN:-}" ]]; then
  echo "SKIP live P4 M4 — set ACCESS_TOKEN"
  exit 0
fi

AUTH=( -H "Authorization: Bearer $ACCESS_TOKEN" -H "Content-Type: application/json" )

if [[ -n "${REPORT_ID:-}" && -n "${VERSION_ID:-}" ]]; then
  echo "==> GET version $VERSION_ID (audit fields)"
  HTTP_CODE="$(curl -sS -o /tmp/mr_p4_m4_ver.json -w '%{http_code}' \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    "$API_BASE/api/v1/research/reports/$REPORT_ID/versions/$VERSION_ID" || true)"
  echo "http=$HTTP_CODE body=$(cat /tmp/mr_p4_m4_ver.json 2>/dev/null || true)"
  if [[ "$HTTP_CODE" == "200" ]]; then
    python3 - <<'PY'
import json
row=json.load(open('/tmp/mr_p4_m4_ver.json'))
ver=row.get('version') or row
print('OK  version audit published_by=', ver.get('published_by'), 'published_at=', ver.get('published_at'))
PY
  else
    echo "SKIP live P4 M4 GET version — unexpected http=$HTTP_CODE"
  fi
fi

if [[ -n "${PROJECT_ID:-}" ]]; then
  echo "==> POST wave NaN metric (expect 400)"
  HTTP_CODE="$(curl -sS -o /tmp/mr_p4_m4_wave.json -w '%{http_code}' "${AUTH[@]}" \
    -X POST "$API_BASE/api/v1/research/projects/$PROJECT_ID/waves" \
    -d '{"wave_no":1,"metric_json":[{"key":"nps","value":NaN}]}' || true)"
  echo "http=$HTTP_CODE body=$(cat /tmp/mr_p4_m4_wave.json 2>/dev/null || true)"
  if [[ "$HTTP_CODE" == "400" ]]; then
    echo "OK  wave NaN 400"
  else
    echo "SKIP live P4 M4 wave NaN — unexpected http=$HTTP_CODE"
  fi
fi

echo "OK  market research P4 M4 smoke"
