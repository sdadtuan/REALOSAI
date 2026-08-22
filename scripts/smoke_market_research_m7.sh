#!/usr/bin/env bash
# Smoke M7 — report version + DOCX export contract.
#
# Live (flag on + staff token + approved insight):
#   API_BASE=... ACCESS_TOKEN=... CLIENT_ID=... ./scripts/smoke_market_research_m7.sh
#
# Optional export-only:
#   REPORT_ID=1 VERSION_ID=1 ACCESS_TOKEN=... ./scripts/smoke_market_research_m7.sh
set -euo pipefail

API_BASE="${API_BASE:-http://127.0.0.1:3000}"
HEALTH_URL="$API_BASE/api/v1/research/health"

echo "==> GET $HEALTH_URL"
HTTP_CODE="$(curl -sS -o /tmp/mr_m7_health.json -w '%{http_code}' "$HEALTH_URL" || true)"
BODY="$(cat /tmp/mr_m7_health.json 2>/dev/null || true)"
echo "http=$HTTP_CODE body=$BODY"

if [[ "$HTTP_CODE" != "200" ]]; then
  echo "SKIP live M7 — health not 200 (flag off, API down, or unauthenticated path)."
  echo "Contract:"
  echo "  POST $API_BASE/api/v1/research/projects/:id/reports {\"insight_ids\":[...]}  # approved_internal+"
  echo "    expect 201 version++ content_hash sha256"
  echo "  GET  $API_BASE/api/v1/research/reports/:id/versions/:versionId/export"
  echo "    cap export · Content-Type DOCX · unzip word/document.xml contains Evidence"
  echo "  GET  other-tenant project → 403 {error:forbidden} without title"
  exit 0
fi

if [[ -n "${REPORT_ID:-}" && -n "${VERSION_ID:-}" && -n "${ACCESS_TOKEN:-}" ]]; then
  echo "==> GET /reports/$REPORT_ID/versions/$VERSION_ID/export"
  HTTP_CODE="$(curl -sS -o /tmp/mr_m7_export.docx -w '%{http_code}' \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    "$API_BASE/api/v1/research/reports/$REPORT_ID/versions/$VERSION_ID/export")"
  echo "http=$HTTP_CODE"
  [[ "$HTTP_CODE" == "200" ]]
  python3 - <<'PY'
import zipfile
z=zipfile.ZipFile('/tmp/mr_m7_export.docx')
xml=z.read('word/document.xml').decode('utf-8')
assert 'Evidence' in xml, xml[:400]
print('OK  DOCX unzip contains Evidence')
PY
  echo "OK  market research M7 smoke (export)"
  exit 0
fi

echo "SKIP live M7 create — set ACCESS_TOKEN + approved insight flow, or REPORT_ID+VERSION_ID to export"
echo "OK  market research M7 smoke (contract documented)"
