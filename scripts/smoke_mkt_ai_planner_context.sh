#!/usr/bin/env bash
# Smoke GET ai-planner/context (WS-INFRA-01 step 5)
# Usage:
#   export ADMIN_PASSWORD=...   # auto-login
#   export PTT_API_URL=http://127.0.0.1:3000   # default on VPS
#   export LIFECYCLE_ID=123    # optional — auto-pick first lifecycle
#   ./scripts/smoke_mkt_ai_planner_context.sh
#
# Or: export STAFF_JWT=eyJ...
# Or: export PTT_CRM_INTERNAL_KEY=...   # x-ptt-internal-key (VPS smoke when .env not readable)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
if [[ -f "$ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env"
  set +a
fi

API_BASE="${PTT_API_URL:-${OPS_UAT_API:-http://127.0.0.1:3000}}"
LIFECYCLE_ID="${LIFECYCLE_ID:-}"
TOKEN="${STAFF_JWT:-${CRM_STAFF_TOKEN:-}}"
INTERNAL_KEY="${PTT_CRM_INTERNAL_KEY:-}"
EMAIL="${ADMIN_EMAIL:-${OPS_E2E_STAFF_EMAIL:-admin@pttads.vn}}"
PASS="${ADMIN_PASSWORD:-${OPS_E2E_STAFF_PASSWORD:-}}"

AUTH=()
if [[ -n "$INTERNAL_KEY" ]]; then
  AUTH=(-H "x-ptt-internal-key: $INTERNAL_KEY")
elif [[ -z "$TOKEN" && -n "$PASS" ]]; then
  echo "==> Staff login $EMAIL @ ${API_BASE}"
  TOKEN="$(
    curl -sf "$API_BASE/api/v1/staff/auth/login" \
      -H 'Content-Type: application/json' \
      -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}" \
    | python3 -c "import sys,json; print(json.load(sys.stdin).get('access_token',''))" 2>/dev/null || true
  )"
fi

if [[ -n "$TOKEN" && ${#AUTH[@]} -eq 0 ]]; then
  AUTH=(-H "Authorization: Bearer $TOKEN")
fi

if [[ ${#AUTH[@]} -eq 0 ]]; then
  echo "Set STAFF_JWT, CRM_STAFF_TOKEN, ADMIN_PASSWORD, or PTT_CRM_INTERNAL_KEY"
  exit 1
fi

if [[ -z "$LIFECYCLE_ID" ]]; then
  echo "==> Resolve lifecycle id (first onboard/deliver if possible)"
  LIFECYCLE_ID="$(
    curl -sf "$API_BASE/api/crm/service-lifecycle?include_draft=1" "${AUTH[@]}" \
    | python3 -c "
import sys, json
ls = json.load(sys.stdin).get('lifecycles') or []
pref = [x for x in ls if str(x.get('stage','')) in ('onboard','deliver')]
pick = pref[0] if pref else (ls[0] if ls else None)
print(pick['id'] if pick else '')
" 2>/dev/null || true
  )"
fi

if [[ -z "$LIFECYCLE_ID" ]]; then
  echo "FAIL no lifecycle found — set LIFECYCLE_ID"
  exit 1
fi

URL="${API_BASE}/api/crm/service-lifecycle/${LIFECYCLE_ID}/ai-planner/context"
echo "==> GET ${URL} (lifecycle #${LIFECYCLE_ID})"

HTTP=$(curl -sS -o /tmp/mkt-ai-context.json -w "%{http_code}" "${AUTH[@]}" "${URL}")

echo "HTTP ${HTTP}"
python3 -m json.tool /tmp/mkt-ai-context.json 2>/dev/null | head -40 || head -c 800 /tmp/mkt-ai-context.json
echo ""

case "$HTTP" in
  200) ;;
  404)
    if grep -q 'mkt_ai_planner_disabled' /tmp/mkt-ai-context.json 2>/dev/null; then
      echo "HINT API flag off — set PTT_MKT_AI_PLANNER_ENABLED=1 and restart ptt-crm-api"
    else
      echo "HINT route missing — deploy MarketingAiPlannerModule to this host"
    fi
    exit 1
    ;;
  403)
    echo "HINT slug pilot — add service_slug to PTT_MKT_AI_PLANNER_SLUGS or clear whitelist"
    exit 1
    ;;
  *)
    echo "FAIL expected 200, got ${HTTP}"
    exit 1
    ;;
esac

for key in lifecycle_id brief draft jobs tmmt_validation flags; do
  if ! grep -q "\"${key}\"" /tmp/mkt-ai-context.json; then
    echo "FAIL missing JSON key: ${key}"
    exit 1
  fi
done

python3 <<'PY'
import json
with open('/tmp/mkt-ai-context.json') as f:
    data = json.load(f)
flags = data.get("flags") or {}
if flags.get("playbook_governance_enabled"):
    gov = data.get("governance")
    if not gov or not gov.get("enabled"):
        print("FAIL governance block missing while playbook_governance_enabled=1")
        raise SystemExit(1)
    if not isinstance(gov.get("notes"), list):
        print("FAIL governance.notes must be array")
        raise SystemExit(1)
    gate = gov.get("launch_qa_gate") or {}
    for k in ("required", "min_score", "ok", "message_vi"):
        if k not in gate:
            print(f"FAIL governance.launch_qa_gate missing {k}")
            raise SystemExit(1)
    print("OK  governance block present")
PY

echo "OK  smoke context passed (lifecycle #${LIFECYCLE_ID})"
