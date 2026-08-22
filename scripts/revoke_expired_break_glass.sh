#!/usr/bin/env bash
# Revoke expired break-glass grants (cron every 15 min)
set -euo pipefail
URL="${PTT_API_URL:-http://127.0.0.1:3000}"
KEY="${PTT_INTERNAL_KEY:-}"

if [[ -z "$KEY" ]]; then
  echo "WARN: PTT_INTERNAL_KEY not set — skip break-glass revoke"
  exit 0
fi

curl -sf -X POST "$URL/api/v1/staff/break-glass/revoke-expired" \
  -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json"
echo ""
echo "OK break-glass revoke-expired"
