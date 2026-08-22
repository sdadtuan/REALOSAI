#!/usr/bin/env bash
# F4 Deal Room quote smoke — catalog filter, auto_lines create, list by lead_id
#
#   export PTT_DEAL_ROOM_ENABLED=1
#   export PTT_DEAL_ROOM_GATE_STRICT=0   # optional — set 1 when G4 green
#   LEAD_ID=900000910 CUSTOMER_ID=1 STAFF_TOKEN=... ./scripts/smoke_deal_room_quote.sh
#
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -f "$ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env"
  set +a
fi

CRM_API="${CRM_API:-http://127.0.0.1:3001}"
TOKEN="${STAFF_TOKEN:?STAFF_TOKEN required}"
LEAD_ID="${LEAD_ID:?LEAD_ID required}"
CUSTOMER_ID="${CUSTOMER_ID:?CUSTOMER_ID required}"
SERVICE_SLUG="${SERVICE_SLUG:-meta-lead-gen}"

HDR=(-H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json")

echo "==> GET /api/crm/proposals/quote-catalog?service_slug=${SERVICE_SLUG}"
curl -sf "${HDR[@]}" "$CRM_API/api/crm/proposals/quote-catalog?service_slug=${SERVICE_SLUG}" \
  | node -pe 'const b=JSON.parse(require("fs").readFileSync(0,"utf8")); if(!b.primary_dv) process.exit(1); if(!b.services?.length) process.exit(1); console.log("primary", b.primary_dv, "services", b.services.length)'

echo "==> POST /api/crm/proposals auto_lines standard (lead_id=${LEAD_ID})"
CREATE=$(curl -sf -X POST "${HDR[@]}" \
  "$CRM_API/api/crm/proposals" \
  -d "{\"customer_id\":$CUSTOMER_ID,\"lead_id\":$LEAD_ID,\"service_slug\":\"${SERVICE_SLUG}\",\"package_tier\":\"standard\",\"auto_lines\":true}")
PID=$(echo "$CREATE" | node -pe 'const b=JSON.parse(require("fs").readFileSync(0,"utf8")); if(!(b.lines?.length>=1)) process.exit(1); console.log(b.id)')
echo "proposal_id=$PID lines=$(echo "$CREATE" | node -pe 'JSON.parse(require("fs").readFileSync(0,"utf8")).lines.length')"

echo "==> GET /api/crm/proposals?lead_id=${LEAD_ID}"
curl -sf "${HDR[@]}" "$CRM_API/api/crm/proposals?lead_id=${LEAD_ID}" \
  | node -pe 'const b=JSON.parse(require("fs").readFileSync(0,"utf8")); if(!b.proposals?.some(p=>p.id=='"$PID"')) process.exit(1); console.log("proposals", b.proposals.length)'

echo "==> GET /api/v1/leads/${LEAD_ID}/deal-room (quote tiers)"
: "${PTT_CRM_INTERNAL_KEY:?PTT_CRM_INTERNAL_KEY required for deal-room GET}"
curl -sf -H "x-ptt-internal-key: ${PTT_CRM_INTERNAL_KEY}" \
  "$CRM_API/api/v1/leads/${LEAD_ID}/deal-room" \
  | node -pe 'const b=JSON.parse(require("fs").readFileSync(0,"utf8")); if(!b.quote?.tiers?.length) process.exit(1); console.log("quote_proposal", b.quote.proposal_id, "tiers", b.quote.tiers.length)'

echo "OK smoke_deal_room_quote"
