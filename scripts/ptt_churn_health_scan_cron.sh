#!/usr/bin/env bash
# RNOS-19 / AI-UC-017 — nightly churn health score (POST /api/v1/ai/score/churn)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

API_URL="${PTT_CRM_API_URL:-http://127.0.0.1:3000}"
INTERNAL_KEY="${PTT_CRM_INTERNAL_KEY:-}"

if [[ -z "$INTERNAL_KEY" ]]; then
  echo "SKIP churn_health_scan — missing PTT_CRM_INTERNAL_KEY" >&2
  exit 0
fi

CORRELATION_ID="churn_health_scan:$(date -u +%Y%m%d)"

HTTP_CODE=$(curl -sS -o /tmp/ptt_churn_health_scan.json -w '%{http_code}' \
  -X POST "${API_URL}/api/v1/ai/score/churn" \
  -H "Content-Type: application/json" \
  -H "x-ptt-internal-key: ${INTERNAL_KEY}" \
  -H "x-correlation-id: ${CORRELATION_ID}" \
  -d '{"force":false,"limit":500}')

if [[ "$HTTP_CODE" == "200" || "$HTTP_CODE" == "201" ]]; then
  echo "OK churn_health_scan HTTP ${HTTP_CODE}"
  cat /tmp/ptt_churn_health_scan.json
  exit 0
fi

echo "FAIL churn_health_scan HTTP ${HTTP_CODE}" >&2
cat /tmp/ptt_churn_health_scan.json >&2
exit 1
