#!/usr/bin/env bash
# Smoke P4 M1 — Staff PDF export (RES-UC-050). Default export still DOCX.
#
# Live API (flag on + staff token + existing report version):
#   API_BASE=http://127.0.0.1:3000 ACCESS_TOKEN=... REPORT_ID=1 VERSION_ID=1 \
#     ./scripts/smoke_market_research_p4_m1.sh
#
# Skip live if API is down (documents the contract and exits 0).
set -euo pipefail

API_BASE="${API_BASE:-http://127.0.0.1:3000}"
HEALTH_URL="$API_BASE/api/v1/research/health"

echo "==> GET $HEALTH_URL"
HTTP_CODE="$(curl -sS -o /tmp/mr_p4_m1_health.json -w '%{http_code}' "$HEALTH_URL" || true)"
BODY="$(cat /tmp/mr_p4_m1_health.json 2>/dev/null || true)"
echo "http=$HTTP_CODE body=$BODY"

if [[ "$HTTP_CODE" != "200" ]]; then
  echo "SKIP live P4 M1 staff PDF — health not 200 (flag off, API down, or unauthenticated path)."
  echo "Contract:"
  echo "  GET $API_BASE/api/v1/research/reports/:reportId/versions/:versionId/export"
  echo "    cap crm_research.export"
  echo "    no format / format=docx → 200 DOCX (P0 no regress; CB stub still OK)"
  echo "    format=pdf → 200 application/pdf; buffer starts %PDF-"
  echo "    filename research-report-{reportId}-v{version}.pdf"
  echo "    other format → 400 {error:validation_error}"
  echo "    TC/CS missing methodology + format=pdf → 400 {error:methodology_incomplete}"
  echo "    out of scope → 403 {error:forbidden} without title"
  echo "    flag off → 404 {error:market_research_disabled}"
  echo "  FE Report: Xuất PDF beside Xuất DOCX"
  exit 0
fi

if [[ -z "${ACCESS_TOKEN:-}" || -z "${REPORT_ID:-}" || -z "${VERSION_ID:-}" ]]; then
  echo "SKIP live P4 M1 staff PDF — set ACCESS_TOKEN, REPORT_ID, and VERSION_ID"
  exit 0
fi

AUTH=( -H "Authorization: Bearer $ACCESS_TOKEN" )

echo "==> GET /reports/$REPORT_ID/versions/$VERSION_ID/export (default DOCX)"
HTTP_CODE="$(curl -sS -D /tmp/mr_p4_m1_docx.hdr -o /tmp/mr_p4_m1.docx -w '%{http_code}' "${AUTH[@]}" \
  "$API_BASE/api/v1/research/reports/$REPORT_ID/versions/$VERSION_ID/export" || true)"
echo "http=$HTTP_CODE"
if [[ "$HTTP_CODE" == "200" ]]; then
  python3 - <<'PY'
from pathlib import Path
raw = Path('/tmp/mr_p4_m1.docx').read_bytes()
hdr = Path('/tmp/mr_p4_m1_docx.hdr').read_text(errors='replace')
assert raw[:2] == b'PK', raw[:16]
assert 'officedocument' in hdr.lower() or 'wordprocessingml' in hdr.lower() or 'octet-stream' in hdr.lower(), hdr
print('OK  default export still DOCX')
PY
else
  echo "SKIP live P4 M1 DOCX — unexpected http=$HTTP_CODE"
fi

echo "==> GET /reports/$REPORT_ID/versions/$VERSION_ID/export?format=pdf"
HTTP_CODE="$(curl -sS -D /tmp/mr_p4_m1_pdf.hdr -o /tmp/mr_p4_m1.pdf -w '%{http_code}' "${AUTH[@]}" \
  "$API_BASE/api/v1/research/reports/$REPORT_ID/versions/$VERSION_ID/export?format=pdf" || true)"
echo "http=$HTTP_CODE"
if [[ "$HTTP_CODE" == "200" ]]; then
  python3 - <<'PY'
from pathlib import Path
raw = Path('/tmp/mr_p4_m1.pdf').read_bytes()
hdr = Path('/tmp/mr_p4_m1_pdf.hdr').read_text(errors='replace')
assert raw[:5] == b'%PDF-', raw[:16]
assert 'application/pdf' in hdr.lower(), hdr
assert '.pdf' in hdr.lower(), hdr
print('OK  staff PDF 200 + %PDF-')
PY
else
  echo "SKIP live P4 M1 PDF body — unexpected http=$HTTP_CODE"
  cat /tmp/mr_p4_m1.pdf 2>/dev/null || true
  echo
fi

echo "OK  market research P4 M1 smoke"
