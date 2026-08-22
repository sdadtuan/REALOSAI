#!/usr/bin/env bash
# P2 post-S0 — Presales AI cap/badge, TMMT apply audit, no auto-email, pilot DV gate
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
WORKSHOP_LEAD_ID="${WORKSHOP_LEAD_ID:-900000910}"

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

echo "==> GET ai-planner context (pilot + BR-AI-01 policy)"
CTX=$(curl -sf "${AUTH[@]}" "$CRM_API/api/crm/service-lifecycle/$LIFECYCLE_ID/ai-planner/context" || true)
if [[ -n "$CTX" ]]; then
  echo "$CTX" | node -pe '
const p=JSON.parse(require("fs").readFileSync(0,"utf8"));
if(p.error) { console.error(p.error); process.exit(1); }
if(!p.customer_email_policy_vi) { console.error("missing customer_email_policy_vi"); process.exit(1); }
if(!p.pilot) { console.error("missing pilot block"); process.exit(1); }
console.log("OK context pilot_only=", p.pilot.pilot_only, "auto_email_flag=", p.flags?.auto_customer_email_enabled);
'
else
  echo "WARN ai-planner context skipped"
fi

echo "==> POST weekly-memo with send_email (expect 403 when PTT_MKT_AI_AUTO_CUSTOMER_EMAIL=0)"
CODE=$(curl -s -o /tmp/p2-memo.json -w '%{http_code}' "${AUTH[@]}" -X POST \
  "$CRM_API/api/crm/service-lifecycle/$LIFECYCLE_ID/ai-planner/jobs/optimize/weekly-memo" \
  -H 'Content-Type: application/json' \
  -d '{"send_email":true,"dry_run":true}' || true)
if [[ "$CODE" == "403" ]]; then
  echo "OK auto customer email blocked HTTP 403"
elif [[ "$CODE" =~ ^2 ]]; then
  echo "WARN weekly-memo accepted send_email — set PTT_MKT_AI_AUTO_CUSTOMER_EMAIL=0 on VPS"
else
  echo "WARN weekly-memo HTTP $CODE (planner may be disabled)"
fi

echo "==> GET presales marketing-plan lead=$WORKSHOP_LEAD_ID (ai_draft field)"
PLAN=$(curl -sf "${AUTH[@]}" "$CRM_API/api/v1/leads/$WORKSHOP_LEAD_ID/presales/marketing-plan" || true)
if [[ -n "$PLAN" ]]; then
  echo "$PLAN" | node -pe '
const p=JSON.parse(require("fs").readFileSync(0,"utf8"));
if(p.error) { console.log("SKIP lead presales:", p.error); process.exit(0); }
if(!("ai_draft" in p)) { console.error("missing ai_draft on GET marketing-plan"); process.exit(1); }
console.log("OK marketing-plan ai_draft field present", p.ai_draft?.is_ai_draft);
'
else
  echo "SKIP presales marketing-plan (lead $WORKSHOP_LEAD_ID missing)"
fi

echo "==> GET ops/catalog pilot DV02/DV04/DV05/DV20"
curl -sf "${AUTH[@]}" "$CRM_API/api/ops/catalog" | node -pe '
const p=JSON.parse(require("fs").readFileSync(0,"utf8"));
const need=new Set(["DV02","DV04","DV05","DV20"]);
for (const s of p.services||[]) need.delete(s.dv_code);
if(need.size) { console.error("missing pilot DV", [...need]); process.exit(1); }
console.log("OK pilot catalog DV ready");
'

echo "OK smoke_p2_post_s0"
