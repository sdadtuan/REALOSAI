#!/usr/bin/env bash
# Smoke M0 — Content Marketing GET /context (requires API + DB + flags)
set -euo pipefail

API_BASE="${API_BASE:-http://127.0.0.1:3000}"
LIFECYCLE_ID="${LIFECYCLE_ID:?Set LIFECYCLE_ID}"
TOKEN="${STAFF_TOKEN:?Set STAFF_TOKEN}"

URL="$API_BASE/api/crm/service-lifecycle/$LIFECYCLE_ID/content-marketing/context"
echo "==> GET $URL"
BODY="$(curl -sf -H "Authorization: Bearer $TOKEN" "$URL")"
echo "$BODY" | jq .

OK="$(echo "$BODY" | jq -r '.ok // empty')"
ENABLED="$(echo "$BODY" | jq -r '.enabled // empty')"
LID="$(echo "$BODY" | jq -r '.lifecycle_id // empty')"

if [[ "$OK" != "true" || "$ENABLED" != "true" || "$LID" != "$LIFECYCLE_ID" ]]; then
  echo "FAIL: unexpected context payload" >&2
  exit 1
fi

echo "OK  content-marketing context M0"
