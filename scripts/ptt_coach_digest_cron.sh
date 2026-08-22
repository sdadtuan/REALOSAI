#!/usr/bin/env bash
# RNOS-21 / AI-UC-018 — weekly manager coach digest + optional email delivery (Mon 08:00 ICT).
# Set PTT_COACH_DIGEST_EMAIL_ENABLED=1 and PTT_COACH_DIGEST_RECIPIENTS on the API.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

API_URL="${PTT_CRM_API_URL:-http://127.0.0.1:3000}"
INTERNAL_KEY="${PTT_CRM_INTERNAL_KEY:-}"

if [[ -z "$INTERNAL_KEY" ]]; then
  echo "SKIP coach_digest — missing PTT_CRM_INTERNAL_KEY" >&2
  exit 0
fi

CORRELATION_ID="coach_digest:$(date -u +%Y%m%d)"

HTTP_CODE=$(curl -sS -o /tmp/ptt_coach_digest.json -w '%{http_code}' \
  -X POST "${API_URL}/api/v1/ai/coach/generate" \
  -H "Content-Type: application/json" \
  -H "x-ptt-internal-key: ${INTERNAL_KEY}" \
  -H "x-correlation-id: ${CORRELATION_ID}" \
  -d '{"force":false,"send":true}')

if [[ "$HTTP_CODE" == "200" || "$HTTP_CODE" == "201" ]]; then
  echo "OK coach_digest HTTP ${HTTP_CODE}"
  cat /tmp/ptt_coach_digest.json
  exit 0
fi

echo "FAIL coach_digest HTTP ${HTTP_CODE}" >&2
cat /tmp/ptt_coach_digest.json >&2
exit 1
