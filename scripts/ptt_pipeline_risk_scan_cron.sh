#!/usr/bin/env bash
# RNOS-23 — Daily pipeline risk scan (stall ≥7d → ai_recommendations alerts).
set -euo pipefail

APP_DIR="${PTT_APP_DIR:-/var/www/ptt}"
API_URL="${PTT_CRM_API_URL:-${PTT_NEST_LEADS_URL:-http://127.0.0.1:3000}}"
API_URL="${API_URL%/}"

env_get() {
  _key="$1"
  _default="${2:-}"
  eval "_cur=\${${_key}:-}"
  if [ -n "$_cur" ]; then
    printf '%s' "$_cur"
    return 0
  fi
  _file="$APP_DIR/.env"
  [ -f "$_file" ] || {
    printf '%s' "$_default"
    return 0
  }
  _line=$(grep -E "^[[:space:]]*${_key}=" "$_file" 2>/dev/null | grep -v '^[[:space:]]*#' | tail -1) || true
  if [ -z "$_line" ]; then
    printf '%s' "$_default"
    return 0
  fi
  _val=${_line#*=}
  case "$_val" in
    \"*) _val=${_val#\"}; _val=${_val%\"} ;;
    \'*) _val=${_val#\'}; _val=${_val%\'} ;;
  esac
  printf '%s' "$_val"
}

INTERNAL_KEY=$(env_get PTT_CRM_INTERNAL_KEY "")
if [ -z "$INTERNAL_KEY" ]; then
  echo "SKIP pipeline_risk_scan — missing PTT_CRM_INTERNAL_KEY" >&2
  exit 0
fi

LIMIT=$(env_get PTT_PIPELINE_RISK_SCAN_LIMIT "200")
CORRELATION_ID="pipeline_risk_scan:$(date -u +%Y%m%d)"

HTTP_CODE=$(curl -sS -o /tmp/ptt_pipeline_risk_scan.json -w '%{http_code}' \
  -X POST "${API_URL}/api/v1/ai/pipeline-risk/scan" \
  -H "Content-Type: application/json" \
  -H "x-ptt-internal-key: ${INTERNAL_KEY}" \
  -H "x-correlation-id: ${CORRELATION_ID}" \
  -d "{\"limit\": ${LIMIT}}")

if [ "$HTTP_CODE" -ge 200 ] && [ "$HTTP_CODE" -lt 300 ]; then
  echo "OK pipeline_risk_scan HTTP ${HTTP_CODE}"
  cat /tmp/ptt_pipeline_risk_scan.json
  exit 0
fi

echo "FAIL pipeline_risk_scan HTTP ${HTTP_CODE}" >&2
cat /tmp/ptt_pipeline_risk_scan.json >&2
exit 1
