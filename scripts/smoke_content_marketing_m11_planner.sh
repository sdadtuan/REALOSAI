#!/usr/bin/env bash
# Smoke M11 — pillars CRUD, ideas-bulk job, PDF brief export, planner ingest surface
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
pref = [x for x in ls if str(x.get('service_slug','')) == 'tiep-thi-noi-dung']
pick = pref[0] if pref else (ls[0] if ls else None)
print(pick['id'] if pick else '')
" 2>/dev/null || true
  )"
fi
if [[ -z "$LIFECYCLE_ID" ]]; then
  echo "FAIL set LIFECYCLE_ID"
  exit 1
fi

BASE="$API_BASE/api/crm/service-lifecycle/$LIFECYCLE_ID/content-marketing"
echo "==> M11 planner glue smoke lifecycle #$LIFECYCLE_ID"

PILLARS="$(curl -sf "${AUTH[@]}" "$BASE/pillars")"
PCOUNT="$(echo "$PILLARS" | python3 -c "import sys,json; print(len(json.load(sys.stdin).get('pillars') or []))")"
echo "pillars_count=$PCOUNT"

if [[ "$PCOUNT" -ge 1 ]]; then
  PID="$(echo "$PILLARS" | python3 -c "import sys,json; print(json.load(sys.stdin)['pillars'][0]['id'])")"
  PATCH="$(curl -sf "${AUTH[@]}" -H 'Content-Type: application/json' \
    -d '{"goal":"M11 smoke goal"}' \
    -X PATCH "$BASE/pillars/$PID")"
  GOAL="$(echo "$PATCH" | python3 -c "import sys,json; print(json.load(sys.stdin)['pillar'].get('goal',''))")"
  if [[ "$GOAL" != "M11 smoke goal" ]]; then
    echo "FAIL pillar patch goal=$GOAL"
    exit 1
  fi
fi

JOB="$(curl -sf "${AUTH[@]}" -H 'Content-Type: application/json' -d '{"idea_count":12}' -X POST "$BASE/jobs/ideas-bulk" 2>/dev/null || true)"
JOB_STATUS="$(echo "$JOB" | python3 -c "import sys,json; print(json.load(sys.stdin).get('status',''))" 2>/dev/null || echo 'failed')"
if [[ "$JOB_STATUS" != "succeeded" ]]; then
  echo "WARN ideas-bulk status=$JOB_STATUS (enable PTT_CONTENT_MARKETING_AI_ENABLED=1 for full pass)"
else
  IDEAS="$(curl -sf "${AUTH[@]}" "$BASE/ideas?status=backlog")"
  ICOUNT="$(echo "$IDEAS" | python3 -c "import sys,json; print(len(json.load(sys.stdin).get('ideas') or []))")"
  if [[ "$ICOUNT" -lt 12 ]]; then
    echo "FAIL ideas backlog count=$ICOUNT expected >=12 after bulk job"
    exit 1
  fi
fi

ITEM_JSON="$(curl -sf "${AUTH[@]}" -H 'Content-Type: application/json' \
  -d '{"title":"M11 PDF smoke","channel":"instagram","format":"carousel","body_json":{"markdown":"Body"}}' \
  -X POST "$BASE/items")"
ITEM_ID="$(echo "$ITEM_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")"

PDF="$(curl -sf "${AUTH[@]}" -X POST "$BASE/items/$ITEM_ID/export/brief-design/pdf")"
PDF_OK="$(echo "$PDF" | python3 -c "import sys,json; print(json.load(sys.stdin).get('ok',False))")"
PDF_B64="$(echo "$PDF" | python3 -c "import sys,json; print(len(json.load(sys.stdin).get('content_base64','')))")"
if [[ "$PDF_OK" != "True" && "$PDF_OK" != "true" ]]; then
  echo "FAIL PDF export ok=$PDF_OK"
  exit 1
fi
if [[ "$PDF_B64" -lt 20 ]]; then
  echo "FAIL PDF export empty content_base64"
  exit 1
fi

PLAN="$(curl -sf "${AUTH[@]}" "$BASE/plan-snapshot")"
HAS_PLAN="$(echo "$PLAN" | python3 -c "import sys,json; print(json.load(sys.stdin).get('planner',{}).get('has_applied_plan',False))")"
echo "planner_has_applied_plan=$HAS_PLAN (FE deep link: ?tab=content-os&view=ideas&import=planner)"

echo "PASS M11 planner glue smoke — item #$ITEM_ID PDF export ok"
