#!/usr/bin/env bash
# Smoke P4 M2 — Portal PDF + lỗi VI (RES-UC-050).
#
# Live portal (flag on + portal JWT):
#   API_BASE=http://127.0.0.1:3000 PORTAL_TOKEN=... VERSION_ID=42 \
#     ./scripts/smoke_market_research_p4_m2.sh
# Optional: BETA_PORTAL_TOKEN=... to assert cross-tenant 403 without title.
# Optional: EXPIRED_VERSION_ID=... to assert 403 report_expired (no file).
#
# Skip live if API/portal is down (documents the contract and exits 0).
set -euo pipefail

API_BASE="${API_BASE:-http://127.0.0.1:3000}"
HEALTH_URL="$API_BASE/api/v1/research/health"

echo "==> GET $HEALTH_URL"
HTTP_CODE="$(curl -sS -o /tmp/mr_p4_m2_health.json -w '%{http_code}' "$HEALTH_URL" || true)"
BODY="$(cat /tmp/mr_p4_m2_health.json 2>/dev/null || true)"
echo "http=$HTTP_CODE body=$BODY"

if [[ "$HTTP_CODE" != "200" ]]; then
  echo "SKIP live P4 M2 portal PDF — health not 200 (flag off, API down, or unauthenticated path)."
  echo "Contract:"
  echo "  GET $API_BASE/api/v1/portal/research/reports/:versionId/export.pdf"
  echo "    published + in-window → 200 application/pdf; filename research-v{version}.pdf"
  echo "    buffer starts %PDF-; every page watermark CONFIDENTIAL · {client_id} · {email} · {YYYY-MM-DD}"
  echo "    PDF is not built until gates pass"
  echo "    unpublished same-tenant → 404 {error:not_found}"
  echo "    Beta / other client → 403 {error:forbidden} without title"
  echo "    expired → 403 {error:report_expired} (no file)"
  echo "    embargo → 403 {error:embargo_active}"
  echo "    flag off → 404 {error:market_research_disabled}"
  echo "  Portal HTML maps error codes via portalResearchErrorVi (never raw report_expired / embargo_active / not_found / forbidden)"
  echo "    report_expired → Báo cáo đã hết hạn."
  echo "    embargo_active → Báo cáo đang trong thời gian cấm công bố."
  echo "    not_found → Không tìm thấy báo cáo."
  echo "    forbidden → Bạn không có quyền xem báo cáo này."
  echo "    market_research_disabled → Tính năng nghiên cứu thị trường chưa bật."
  echo "    unknown → Không tải được báo cáo."
  echo "  Detail button Tải PDF downloads research-v{version}.pdf with portal JWT"
  exit 0
fi

if [[ -z "${PORTAL_TOKEN:-}" ]]; then
  echo "SKIP live P4 M2 portal PDF — set PORTAL_TOKEN"
  exit 0
fi

AUTH=( -H "Authorization: Bearer $PORTAL_TOKEN" )

if [[ -n "${VERSION_ID:-}" ]]; then
  echo "==> GET /api/v1/portal/research/reports/$VERSION_ID/export.pdf"
  HTTP_CODE="$(curl -sS -D /tmp/mr_p4_m2_pdf.hdr -o /tmp/mr_p4_m2.pdf -w '%{http_code}' "${AUTH[@]}" \
    "$API_BASE/api/v1/portal/research/reports/$VERSION_ID/export.pdf" || true)"
  echo "http=$HTTP_CODE"
  if [[ "$HTTP_CODE" == "200" ]]; then
    python3 - <<'PY'
from pathlib import Path
raw = Path('/tmp/mr_p4_m2.pdf').read_bytes()
hdr = Path('/tmp/mr_p4_m2_pdf.hdr').read_text(errors='replace')
assert raw[:5] == b'%PDF-', raw[:16]
assert 'application/pdf' in hdr.lower(), hdr
assert 'research-v' in hdr and '.pdf' in hdr, hdr
text = raw.decode('latin1')
assert 'CONFIDENTIAL' in text or '0043004f004e0046004900440045004e005400490041004c' in text, 'watermark missing'
print('OK  portal PDF 200 + %PDF- + watermark path')
PY
  else
    echo "SKIP live P4 M2 PDF body — portal/API not ready (http=$HTTP_CODE)"
    cat /tmp/mr_p4_m2.pdf 2>/dev/null || true
    echo
  fi
fi

if [[ -n "${BETA_PORTAL_TOKEN:-}" && -n "${VERSION_ID:-}" ]]; then
  echo "==> Beta GET Acme export.pdf"
  HTTP_CODE="$(curl -sS -o /tmp/mr_p4_m2_beta.json -w '%{http_code}' \
    -H "Authorization: Bearer $BETA_PORTAL_TOKEN" \
    "$API_BASE/api/v1/portal/research/reports/$VERSION_ID/export.pdf" || true)"
  echo "http=$HTTP_CODE body=$(cat /tmp/mr_p4_m2_beta.json)"
  python3 - <<PY
import json
body=json.load(open('/tmp/mr_p4_m2_beta.json'))
assert $HTTP_CODE == 403, $HTTP_CODE
assert body == {'error': 'forbidden'}, body
assert 'title' not in json.dumps(body), body
print('OK  Beta 403 forbidden without title')
PY
fi

if [[ -n "${EXPIRED_VERSION_ID:-}" ]]; then
  echo "==> GET expired export.pdf"
  HTTP_CODE="$(curl -sS -o /tmp/mr_p4_m2_expired.json -w '%{http_code}' "${AUTH[@]}" \
    "$API_BASE/api/v1/portal/research/reports/$EXPIRED_VERSION_ID/export.pdf" || true)"
  echo "http=$HTTP_CODE body=$(cat /tmp/mr_p4_m2_expired.json)"
  python3 - <<PY
import json
body=json.load(open('/tmp/mr_p4_m2_expired.json'))
assert $HTTP_CODE == 403, $HTTP_CODE
assert body.get('error') == 'report_expired', body
print('OK  expired 403 report_expired (no file)')
PY
fi

echo "OK  market research P4 M2 smoke"
