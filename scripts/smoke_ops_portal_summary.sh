#!/usr/bin/env bash
set -euo pipefail

CRM_API="${CRM_API:-http://127.0.0.1:3000}"
TOKEN="${PORTAL_TOKEN:?PORTAL_TOKEN required}"
LIFECYCLE_ID="${LIFECYCLE_ID:-}"

echo "==> GET /api/v1/portal/ops/linked"
LINKED=$(curl -sf -H "Authorization: Bearer $TOKEN" "$CRM_API/api/v1/portal/ops/linked")
echo "$LINKED" | node -pe 'const b=JSON.parse(require("fs").readFileSync(0,"utf8")); console.log("enabled", b.enabled, "lifecycle", b.lifecycle_id)'

LC=$(echo "$LINKED" | node -pe 'JSON.parse(require("fs").readFileSync(0,"utf8")).lifecycle_id')
if [[ -n "$LIFECYCLE_ID" ]]; then
  LC="$LIFECYCLE_ID"
fi
if [[ -z "$LC" || "$LC" == "null" ]]; then
  echo "SKIP summary — no linked lifecycle (set LIFECYCLE_ID or map portal client)"
  echo "OK smoke_ops_portal_summary (partial)"
  exit 0
fi

echo "==> GET /api/v1/portal/ops/lifecycle/$LC/summary"
curl -sf -H "Authorization: Bearer $TOKEN" \
  "$CRM_API/api/v1/portal/ops/lifecycle/$LC/summary" \
  | node -pe 'const b=JSON.parse(require("fs").readFileSync(0,"utf8")); if(!b.dv_code) process.exit(1); console.log("dv", b.dv_code, "weekly", b.weekly.progress_pct, "kpi", b.kpi.overall_label)'

echo "OK smoke_ops_portal_summary"
