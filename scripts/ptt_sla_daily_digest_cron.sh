#!/usr/bin/env bash
# Phase 2 — SLA daily digest for GDKD (08:00 ICT cron). Read-only payload for Slack/email.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
API_BASE="${PTT_CRM_API_BASE:-http://127.0.0.1:3001}"

if [[ -z "${PTT_CRM_INTERNAL_KEY:-}" ]]; then
  echo "SKIP sla_daily_digest — missing PTT_CRM_INTERNAL_KEY" >&2
  exit 0
fi

CORRELATION_ID="sla_daily_digest:$(date -u +%Y%m%d)"
HTTP_CODE=$(curl -sS -o /tmp/ptt_sla_daily_digest.json -w '%{http_code}' \
  -H "x-ptt-internal-key: ${PTT_CRM_INTERNAL_KEY}" \
  -H "x-correlation-id: ${CORRELATION_ID}" \
  "${API_BASE}/api/crm/cskh-board/sla-daily-digest")

if [[ "${HTTP_CODE}" =~ ^2 ]]; then
  echo "OK sla_daily_digest HTTP ${HTTP_CODE}"
  cat /tmp/ptt_sla_daily_digest.json
  exit 0
fi

echo "FAIL sla_daily_digest HTTP ${HTTP_CODE}" >&2
cat /tmp/ptt_sla_daily_digest.json >&2
exit 1
