#!/usr/bin/env bash
set -euo pipefail

CRM_API="${CRM_API:-http://127.0.0.1:3001}"
TOKEN="${STAFF_TOKEN:?STAFF_TOKEN required}"
LIFECYCLE_ID="${LIFECYCLE_ID:?LIFECYCLE_ID required}"
SPAWN="${SPAWN:-0}"

echo "==> GET /api/ops/catalog"
COUNT=$(curl -sf -H "Authorization: Bearer $TOKEN" "$CRM_API/api/ops/catalog" | node -pe 'JSON.parse(require("fs").readFileSync(0,"utf8")).services.length')
if [ "$COUNT" != "21" ]; then
  echo "FAIL expected 21 services, got $COUNT"
  exit 1
fi

echo "==> GET /api/ops/lifecycle/$LIFECYCLE_ID/hub"
HUB=$(curl -sf -H "Authorization: Bearer $TOKEN" "$CRM_API/api/ops/lifecycle/$LIFECYCLE_ID/hub")
echo "$HUB" | node -pe 'const b=JSON.parse(require("fs").readFileSync(0,"utf8")); if(!b.dv?.dv_code) process.exit(1); console.log("dv", b.dv.dv_code, "engines", b.engines?.length ?? 0, "kpi", b.kpi?.metrics?.length ?? 0)'

echo "==> GET /api/ops/lifecycle/$LIFECYCLE_ID/kpi"
curl -sf -H "Authorization: Bearer $TOKEN" \
  "$CRM_API/api/ops/lifecycle/$LIFECYCLE_ID/kpi?period_type=month" \
  | node -pe 'const b=JSON.parse(require("fs").readFileSync(0,"utf8")); if(!Array.isArray(b.metrics)) process.exit(1); console.log("metrics", b.metrics.length)'

if [ "$SPAWN" = "1" ]; then
  echo "==> POST /api/ops/lifecycle/$LIFECYCLE_ID/spawn-week"
  curl -sf -X POST -H "Authorization: Bearer $TOKEN" \
    "$CRM_API/api/ops/lifecycle/$LIFECYCLE_ID/spawn-week" \
    | node -pe 'const b=JSON.parse(require("fs").readFileSync(0,"utf8")); console.log("spawn", b.iso_week, "items", b.items?.length ?? 0)'
fi

echo "OK smoke_ops_dv_hub"
