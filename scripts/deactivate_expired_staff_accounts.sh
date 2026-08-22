#!/usr/bin/env bash
# Deactivate guest/contractor accounts past expires_at (cron hourly)
set -euo pipefail
URL="${PTT_API_URL:-http://127.0.0.1:3000}"
KEY="${PTT_INTERNAL_KEY:-}"

if [[ -z "$KEY" ]]; then
  echo "WARN: PTT_INTERNAL_KEY not set — skip guest expiry"
  exit 0
fi

curl -sf -X POST "$URL/api/v1/admin/governance/deactivate-expired-accounts" \
  -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json"
echo ""
echo "OK guest account expiry"
