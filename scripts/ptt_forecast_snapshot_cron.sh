#!/usr/bin/env bash
# RNOS-17 / AI-UC-013 — Daily revenue forecast snapshot cron (07:00 ICT)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -f "$ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env"
  set +a
fi

API_BASE="${PTT_CRM_API_URL:-http://127.0.0.1:3000}"
INTERNAL_KEY="${PTT_CRM_INTERNAL_KEY:-}"

if [[ -z "$INTERNAL_KEY" ]]; then
  echo "SKIP forecast_snapshot — missing PTT_CRM_INTERNAL_KEY" >&2
  exit 0
fi

CORRELATION_ID="forecast_snapshot:$(date -u +%Y%m%d)"

HTTP_CODE=$(curl -sS -o /tmp/ptt_forecast_snapshot.json -w '%{http_code}' \
  -X POST "${API_BASE}/api/v1/ai/forecast" \
  -H "Content-Type: application/json" \
  -H "x-ptt-internal-key: ${INTERNAL_KEY}" \
  -H "x-correlation-id: ${CORRELATION_ID}" \
  -d '{}')

if [[ "$HTTP_CODE" == "200" || "$HTTP_CODE" == "201" ]]; then
  echo "OK forecast_snapshot HTTP ${HTTP_CODE}"
  cat /tmp/ptt_forecast_snapshot.json
  exit 0
fi

echo "FAIL forecast_snapshot HTTP ${HTTP_CODE}" >&2
cat /tmp/ptt_forecast_snapshot.json >&2
exit 1
