#!/usr/bin/env bash
set -euo pipefail

CRM_API="${CRM_API:-http://127.0.0.1:3001}"
TOKEN="${STAFF_TOKEN:?STAFF_TOKEN required}"
CUSTOMER_ID="${CUSTOMER_ID:?CUSTOMER_ID required}"
LEAD_ID="${LEAD_ID:-}"

HDR=(-H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json")

echo "==> GET /api/crm/proposals/quote-catalog"
curl -sf -H "Authorization: Bearer $TOKEN" "$CRM_API/api/crm/proposals/quote-catalog" \
  | node -pe 'const b=JSON.parse(require("fs").readFileSync(0,"utf8")); if(!b.services?.length) process.exit(1); console.log("services", b.services.length)'

if [[ -n "$LEAD_ID" ]]; then
  echo "==> GET /api/crm/proposals?lead_id=${LEAD_ID}"
  curl -sf -H "Authorization: Bearer $TOKEN" "$CRM_API/api/crm/proposals?lead_id=${LEAD_ID}" \
    | node -pe 'const b=JSON.parse(require("fs").readFileSync(0,"utf8")); console.log("lead_proposals", b.proposals?.length ?? 0)'
fi

echo "==> POST /api/crm/proposals (quote lines)"
CREATE_BODY="{\"customer_id\":$CUSTOMER_ID,\"lines\":[{\"dv_code\":\"DV05\",\"package_tier\":\"standard\"}]}"
if [[ -n "$LEAD_ID" ]]; then
  CREATE_BODY="{\"customer_id\":$CUSTOMER_ID,\"lead_id\":$LEAD_ID,\"lines\":[{\"dv_code\":\"DV05\",\"package_tier\":\"standard\"}]}"
fi
CREATE=$(curl -sf -X POST "${HDR[@]}" \
  "$CRM_API/api/crm/proposals" \
  -d "$CREATE_BODY")
PID=$(echo "$CREATE" | node -pe 'JSON.parse(require("fs").readFileSync(0,"utf8")).id')
echo "proposal_id=$PID"

echo "==> POST /api/crm/proposals/$PID/export?format=pdf"
curl -sf -X POST -H "Authorization: Bearer $TOKEN" \
  "$CRM_API/api/crm/proposals/$PID/export?format=pdf" -o "/tmp/ptt-quote-$PID.pdf"
test -s "/tmp/ptt-quote-$PID.pdf" && echo "pdf OK"

if [ "${ACCEPT:-0}" = "1" ]; then
  echo "==> PATCH accepted → lifecycle"
  curl -sf -X PATCH -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
    "$CRM_API/api/crm/proposals/$PID/status" \
    -d '{"status":"accepted","spawn_week":true}' \
    | node -pe 'const b=JSON.parse(require("fs").readFileSync(0,"utf8")); console.log("lifecycles", b.lifecycles?.length ?? 0)'
fi

echo "OK smoke_ops_quote"
