#!/usr/bin/env bash
# MKT-AI KPI drift alert weekly scan (WS-P2-03 / MKTP-UC-018)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
API_BASE="${PTT_CRM_API_BASE:-http://127.0.0.1:3000}"

if [[ "${PTT_MKT_AI_KPI_ALERT_ENABLED:-0}" != "1" ]]; then
  echo "SKIP mkt_ai_kpi_alert — PTT_MKT_AI_KPI_ALERT_ENABLED!=1" >&2
  exit 0
fi

if [[ -z "${PTT_CRM_INTERNAL_KEY:-}" ]]; then
  echo "SKIP mkt_ai_kpi_alert — missing PTT_CRM_INTERNAL_KEY" >&2
  exit 0
fi

CORRELATION_ID="mkt_ai_kpi_alert:$(date -u +%Y%m%d)"
HTTP_CODE=$(curl -sS -o /tmp/mkt_ai_kpi_alert.json -w '%{http_code}' \
  -X POST \
  -H "Content-Type: application/json" \
  -H "x-ptt-internal-key: ${PTT_CRM_INTERNAL_KEY}" \
  -H "x-correlation-id: ${CORRELATION_ID}" \
  -d '{}' \
  "${API_BASE}/api/crm/mkt-ai-planner/alerts/run")

if [[ "${HTTP_CODE}" =~ ^2 ]]; then
  echo "OK mkt_ai_kpi_alert HTTP ${HTTP_CODE}"
  cat /tmp/mkt_ai_kpi_alert.json
  exit 0
fi

echo "FAIL mkt_ai_kpi_alert HTTP ${HTTP_CODE}" >&2
cat /tmp/mkt_ai_kpi_alert.json >&2
exit 1
