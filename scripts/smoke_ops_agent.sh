#!/usr/bin/env bash
set -euo pipefail

CRM_API="${CRM_API:-http://127.0.0.1:3001}"
TOKEN="${STAFF_TOKEN:?STAFF_TOKEN required}"
LIFECYCLE_ID="${LIFECYCLE_ID:-}"

echo "==> GET /api/ops/agent/status"
curl -sf -H "Authorization: Bearer $TOKEN" "$CRM_API/api/ops/agent/status" \
  | node -pe 'const b=JSON.parse(require("fs").readFileSync(0,"utf8")); if(b.ok!==true) process.exit(1); console.log("enabled", b.enabled)'

echo "==> POST /api/ops/agent/run?dry_run=1"
curl -sf -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"dry_run":true}' "$CRM_API/api/ops/agent/run" \
  | node -pe 'const b=JSON.parse(require("fs").readFileSync(0,"utf8")); console.log("scan", b.ok, "scanned", b.scanned)'

echo "==> GET /api/ops/alerts"
curl -sf -H "Authorization: Bearer $TOKEN" "$CRM_API/api/ops/alerts?status=open&limit=5" \
  | node -pe 'const b=JSON.parse(require("fs").readFileSync(0,"utf8")); if(!Array.isArray(b.items)) process.exit(1); console.log("alerts", b.items.length)'

echo "==> GET /api/ops/dashboard/am"
curl -sf -H "Authorization: Bearer $TOKEN" "$CRM_API/api/ops/dashboard/am" \
  | node -pe 'const b=JSON.parse(require("fs").readFileSync(0,"utf8")); if(!Array.isArray(b.instances)) process.exit(1); console.log("instances", b.instances.length)'

echo "==> GET /api/ops/dashboard/specialist"
curl -sf -H "Authorization: Bearer $TOKEN" "$CRM_API/api/ops/dashboard/specialist" \
  | node -pe 'const b=JSON.parse(require("fs").readFileSync(0,"utf8")); if(!Array.isArray(b.tasks)) process.exit(1); console.log("tasks", b.tasks.length)'

if [ -n "$LIFECYCLE_ID" ]; then
  echo "==> GET /api/ops/lifecycle/$LIFECYCLE_ID/hub (alerts section)"
  curl -sf -H "Authorization: Bearer $TOKEN" "$CRM_API/api/ops/lifecycle/$LIFECYCLE_ID/hub" \
    | node -pe 'const b=JSON.parse(require("fs").readFileSync(0,"utf8")); if(!b.alerts) process.exit(1); console.log("hub alerts", b.alerts.open_count)'
fi

echo "OK smoke_ops_agent"
