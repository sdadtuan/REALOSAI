#!/usr/bin/env bash
# F5 Deal Room portal teaser smoke
#
#   export PTT_DEAL_ROOM_ENABLED=1 PTT_DEAL_ROOM_PORTAL_TEASER=1
#   LEAD_ID=900000910 STAFF_TOKEN=... ./scripts/smoke_deal_room_teaser.sh
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
HDR=(-H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json")

echo "==> POST /api/v1/leads/${LEAD_ID}/deal-room/teaser"
CREATE=$(curl -sf -X POST "${HDR[@]}" "$CRM_API/api/v1/leads/${LEAD_ID}/deal-room/teaser")
URL=$(echo "$CREATE" | node -pe 'const b=JSON.parse(require("fs").readFileSync(0,"utf8")); if(!b.url) process.exit(1); console.log(b.url)')
RAW=$(node -pe 'const u=new URL(process.argv[1]); console.log(decodeURIComponent(u.pathname.split("/").pop()))' "$URL")
echo "teaser_url=$URL"

echo "==> GET /api/portal/deal-teaser/:token"
curl -sf "$CRM_API/api/portal/deal-teaser/${RAW}" \
  | node -pe 'const b=JSON.parse(require("fs").readFileSync(0,"utf8")); if(!b.ok||!b.project_name) process.exit(1); console.log("project", b.project_name, "blocks", b.strategy_blocks?.length ?? 0)'

echo "==> DELETE /api/v1/leads/${LEAD_ID}/deal-room/teaser"
curl -sf -X DELETE "${HDR[@]}" "$CRM_API/api/v1/leads/${LEAD_ID}/deal-room/teaser" \
  | node -pe 'const b=JSON.parse(require("fs").readFileSync(0,"utf8")); if(b.revoked!==true) process.exit(1); console.log("revoked")'

echo "==> GET revoked token → expect 410"
code="$(curl -s -o /tmp/teaser-revoked.json -w '%{http_code}' "$CRM_API/api/portal/deal-teaser/${RAW}")"
[[ "$code" == "410" ]] && echo "OK 410 Gone" || { echo "FAIL expected 410 got $code"; cat /tmp/teaser-revoked.json; exit 1; }

echo "OK smoke_deal_room_teaser"
