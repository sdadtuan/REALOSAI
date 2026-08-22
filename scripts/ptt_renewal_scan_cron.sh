#!/usr/bin/env bash
# RNOS-20 / AI-UC-014 — Renewal T-90/60/30 scan cron
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
  echo "SKIP renewal_scan — missing PTT_CRM_INTERNAL_KEY" >&2
  exit 0
fi

CORRELATION_ID="renewal_scan:$(date -u +%Y%m%d)"

HTTP_CODE=$(curl -sS -o /tmp/ptt_renewal_scan.json -w '%{http_code}' \
  -X POST "${API_BASE}/api/v1/ai/renewal/scan" \
  -H "Content-Type: application/json" \
  -H "x-ptt-internal-key: ${INTERNAL_KEY}" \
  -H "x-correlation-id: ${CORRELATION_ID}" \
  -d '{"windows":[90,60,30]}')

if [[ "$HTTP_CODE" == "200" || "$HTTP_CODE" == "201" ]]; then
  echo "OK renewal_scan HTTP ${HTTP_CODE}"
  cat /tmp/ptt_renewal_scan.json
  exit 0
fi

echo "FAIL renewal_scan HTTP ${HTTP_CODE}" >&2
cat /tmp/ptt_renewal_scan.json >&2
exit 1
