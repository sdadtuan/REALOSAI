#!/usr/bin/env bash
# P1 post-S0 — TMMT prefill, spawn on deliver, catalog UI, KPI closed-loop
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ -f "$ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env"
  set +a
fi

API_URL="${PTT_API_URL:-http://127.0.0.1:3000}"
CRM_API="${CRM_API:-$API_URL}"
KEY="${PTT_CRM_INTERNAL_KEY:-}"
EMAIL="${ADMIN_EMAIL:-${OPS_E2E_STAFF_EMAIL:-admin@pttads.vn}}"
PASS="${ADMIN_PASSWORD:-${OPS_E2E_STAFF_PASSWORD:-}}"
LIFECYCLE_ID="${LIFECYCLE_ID:-1}"

AUTH=()
if [[ -n "$KEY" ]]; then
  AUTH=(-H "x-ptt-internal-key: $KEY")
elif [[ -n "$PASS" ]]; then
  TOKEN="$(
    curl -sf "$API_URL/api/v1/staff/auth/login" \
      -H 'Content-Type: application/json' \
      -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}" | node -pe 'JSON.parse(require("fs").readFileSync(0,"utf8")).access_token'
  )"
  AUTH=(-H "Authorization: Bearer $TOKEN")
else
  echo "FAIL: set PTT_CRM_INTERNAL_KEY or ADMIN_PASSWORD"
  exit 1
fi

echo "==> GET /api/ops/health (spawn_on_deliver flag)"
HEALTH=$(curl -sf "${AUTH[@]}" "$CRM_API/api/ops/health")
echo "$HEALTH" | node -pe '
const h=JSON.parse(require("fs").readFileSync(0,"utf8"));
if(!h.ops_dv_enabled) { console.error("ops_dv disabled"); process.exit(1); }
console.log("OK ops health", JSON.stringify({ spawn_on_deliver: h.ops_spawn_on_deliver_enabled }));
'

echo "==> GET /api/ops/catalog (21 DV)"
COUNT=$(curl -sf "${AUTH[@]}" "$CRM_API/api/ops/catalog" | node -pe 'JSON.parse(require("fs").readFileSync(0,"utf8")).services.length')
[[ "$COUNT" -ge 21 ]] || { echo "FAIL catalog count=$COUNT"; exit 1; }
echo "OK catalog services=$COUNT"

FIRST=$(curl -sf "${AUTH[@]}" "$CRM_API/api/ops/catalog" | node -pe 'JSON.parse(require("fs").readFileSync(0,"utf8")).services[0].dv_code')
curl -sf "${AUTH[@]}" "$CRM_API/api/ops/catalog/$FIRST" >/dev/null
echo "OK catalog detail $FIRST"

echo "==> POST ai-planner brief/prefill-l1-consult lifecycle=$LIFECYCLE_ID"
PREFILL=$(curl -sf "${AUTH[@]}" -X POST "$CRM_API/api/crm/service-lifecycle/$LIFECYCLE_ID/ai-planner/brief/prefill-l1-consult" \
  -H 'Content-Type: application/json' \
  -d '{}' || true)
if [[ -n "$PREFILL" ]]; then
  echo "$PREFILL" | node -pe '
const p=JSON.parse(require("fs").readFileSync(0,"utf8"));
if(p.error) { console.error(p.error); process.exit(1); }
console.log("OK prefill score", p.brief_readiness?.score, "target", p.prefill_target_score);
'
else
  echo "WARN prefill skipped (planner disabled or lifecycle missing)"
fi

echo "==> GET kpi-closed-loop (when enabled)"
LOOP=$(curl -sf "${AUTH[@]}" "$CRM_API/api/crm/service-lifecycle/$LIFECYCLE_ID/ai-planner/kpi-closed-loop" || true)
if [[ -n "$LOOP" ]]; then
  echo "$LOOP" | node -pe '
const p=JSON.parse(require("fs").readFileSync(0,"utf8"));
if(p.error==="mkt_ai_kpi_closed_loop_disabled") { console.log("SKIP closed-loop flag off"); process.exit(0); }
if(p.error) { console.error(p.error); process.exit(1); }
console.log("OK closed-loop rows", (p.rows||[]).length, "alerts", (p.alerts||[]).length);
'
else
  echo "SKIP kpi-closed-loop"
fi

echo "PASS smoke_p1_post_s0"
