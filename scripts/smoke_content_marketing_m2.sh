#!/usr/bin/env bash
# Smoke M2 — plan-snapshot ingest (requires applied TMMT on lifecycle)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
if [[ -f "$ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env"
  set +a
fi

API_BASE="${PTT_API_URL:-http://127.0.0.1:3000}"
LIFECYCLE_ID="${LIFECYCLE_ID:-}"
TOKEN="${STAFF_JWT:-${CRM_STAFF_TOKEN:-}}"
INTERNAL_KEY="${PTT_CRM_INTERNAL_KEY:-}"
EMAIL="${ADMIN_EMAIL:-${OPS_E2E_STAFF_EMAIL:-admin@pttads.vn}}"
PASS="${ADMIN_PASSWORD:-${OPS_E2E_STAFF_PASSWORD:-}}"

AUTH=()
if [[ -n "$INTERNAL_KEY" ]]; then
  AUTH=(-H "x-ptt-internal-key: $INTERNAL_KEY")
elif [[ -z "$TOKEN" && -n "$PASS" ]]; then
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
  echo "Set STAFF_JWT, ADMIN_PASSWORD, or PTT_CRM_INTERNAL_KEY"
  exit 1
fi

if [[ -z "$LIFECYCLE_ID" ]]; then
  LIFECYCLE_ID="$(
    curl -sf "$API_BASE/api/crm/service-lifecycle?include_draft=1" "${AUTH[@]}" \
    | python3 -c "
import sys, json
ls = json.load(sys.stdin).get('lifecycles') or []
pref = [x for x in ls if str(x.get('service_slug','')) == 'tiep-thi-noi-dung' and x.get('marketing_plan_id')]
if not pref:
  pref = [x for x in ls if x.get('marketing_plan_id')]
pick = pref[0] if pref else None
print(pick['id'] if pick else '')
" 2>/dev/null || true
  )"
fi
if [[ -z "$LIFECYCLE_ID" ]]; then
  echo "FAIL set LIFECYCLE_ID with marketing_plan_id (Apply TMMT trước)"
  exit 1
fi

BASE="$API_BASE/api/crm/service-lifecycle/$LIFECYCLE_ID/content-marketing"
echo "==> M2 smoke lifecycle #$LIFECYCLE_ID"

PLAN_JSON="$(curl -sf "${AUTH[@]}" "$BASE/plan-snapshot")"
HAS_PLAN="$(echo "$PLAN_JSON" | python3 -c "import sys,json; print('1' if json.load(sys.stdin).get('planner',{}).get('has_applied_plan') else '0')")"
if [[ "$HAS_PLAN" != "1" ]]; then
  echo "FAIL no applied marketing plan on lifecycle $LIFECYCLE_ID"
  exit 1
fi

INGEST_JSON="$(curl -sf "${AUTH[@]}" -H 'Content-Type: application/json' \
  -d '{"mode":"merge","import_calendar":true,"import_pillars":true}' \
  -X POST "$BASE/plan-snapshot/ingest")"
IDEAS_CREATED="$(echo "$INGEST_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin).get('ideas_created',0))")"
SNAP_ID="$(echo "$INGEST_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin).get('snapshot_id',0))")"
if [[ "$SNAP_ID" -le 0 ]]; then
  echo "FAIL ingest missing snapshot_id: $INGEST_JSON"
  exit 1
fi
echo "Ingest snapshot #$SNAP_ID ideas_created=$IDEAS_CREATED"

CTX_JSON="$(curl -sf "${AUTH[@]}" "$BASE/context")"
IDEA_COUNT="$(echo "$CTX_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin).get('counts',{}).get('ideas',0))")"
if [[ "$IDEA_COUNT" -le 0 && "$IDEAS_CREATED" -le 0 ]]; then
  echo "FAIL no ideas after ingest (calendar empty?) ideas_created=$IDEAS_CREATED count=$IDEA_COUNT"
  exit 1
fi

echo "OK  smoke_content_marketing_m2 passed (snapshot $SNAP_ID, ideas $IDEA_COUNT)"
