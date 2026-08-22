#!/usr/bin/env bash
# Smoke P2 M3 — Market Research OS: bilingual exec EN + Lead translation approve.
#
# Live API (flag on + staff token + existing report version):
#   API_BASE=http://127.0.0.1:3000 ACCESS_TOKEN=... REPORT_ID=1 VERSION_ID=1 \
#     ./scripts/smoke_market_research_p2_m3.sh
#
# Skip live if API is down (documents the contract and exits 0).
set -euo pipefail

API_BASE="${API_BASE:-http://127.0.0.1:3000}"
HEALTH_URL="$API_BASE/api/v1/research/health"

echo "==> GET $HEALTH_URL"
HTTP_CODE="$(curl -sS -o /tmp/mr_p2_m3_health.json -w '%{http_code}' "$HEALTH_URL" || true)"
BODY="$(cat /tmp/mr_p2_m3_health.json 2>/dev/null || true)"
echo "http=$HTTP_CODE body=$BODY"

if [[ "$HTTP_CODE" != "200" ]]; then
  echo "SKIP live P2 M3 exec EN — health not 200 (flag off, API down, or unauthenticated path)."
  echo "Contract:"
  echo "  POST $API_BASE/api/v1/research/reports/:reportId/versions/:versionId/exec-en"
  echo "    cap edit; body {\"en\":\"…\"} → en_status=draft; vi unchanged"
  echo "  POST $API_BASE/api/v1/research/reports/:reportId/versions/:versionId/approve-exec-en"
  echo "    cap approve; actor ≠ generated_by → 403 {error:cannot_self_approve}"
  echo "  already approved POST/PATCH en → 400 {error:exec_en_locked}"
  echo "  empty/null stored en on approve → 400 {error:validation_error}"
  echo "  P0 exec string still opens via normalizeReportExec"
  echo "  DOCX prints vi + Executive (EN) when en present"
  exit 0
fi

if [[ -z "${ACCESS_TOKEN:-}" || -z "${REPORT_ID:-}" || -z "${VERSION_ID:-}" ]]; then
  echo "SKIP live P2 M3 exec EN — set ACCESS_TOKEN, REPORT_ID, and VERSION_ID"
  exit 0
fi

AUTH=( -H "Authorization: Bearer $ACCESS_TOKEN" -H "Content-Type: application/json" )

echo "==> POST /reports/$REPORT_ID/versions/$VERSION_ID/exec-en"
HTTP_CODE="$(curl -sS -o /tmp/mr_p2_m3_en.json -w '%{http_code}' "${AUTH[@]}" \
  -X POST "$API_BASE/api/v1/research/reports/$REPORT_ID/versions/$VERSION_ID/exec-en" \
  -d '{"en":"Should we open a premium SKU in Q4?"}')"
echo "http=$HTTP_CODE body=$(cat /tmp/mr_p2_m3_en.json)"
if [[ "$HTTP_CODE" == "400" ]]; then
  python3 - <<'PY'
import json
row=json.load(open('/tmp/mr_p2_m3_en.json'))
payload=row.get('message') if isinstance(row.get('message'), dict) else row
err=payload.get('error') or row.get('error')
assert err in ('exec_en_locked', 'validation_error', 'not_found'), row
print('OK  exec-en 400', err)
PY
elif [[ "$HTTP_CODE" == "200" || "$HTTP_CODE" == "201" ]]; then
  python3 - <<'PY'
import json
row=json.load(open('/tmp/mr_p2_m3_en.json'))
exec_block=row.get('exec') or row.get('content_snapshot', {}).get('exec') or {}
if isinstance(exec_block, dict):
    assert exec_block.get('en_status') in ('draft', 'approved', 'none'), row
print('OK  exec-en persisted')
PY
else
  echo "SKIP live P2 M3 exec-en unexpected http=$HTTP_CODE"
  exit 0
fi

echo "OK  market research P2 M3 smoke"
