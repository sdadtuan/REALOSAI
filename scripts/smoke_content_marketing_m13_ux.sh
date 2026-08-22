#!/usr/bin/env bash
# Smoke M13 — UX polish: context counts, drift-diff, review SLA sort, email client resolve
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
echo "==> M13 UX smoke lifecycle #$LIFECYCLE_ID"

CTX="$(curl -sf "${AUTH[@]}" "$BASE/context")"
SCHED_WEEK="$(echo "$CTX" | python3 -c "import sys,json; print(json.load(sys.stdin).get('counts',{}).get('scheduled_this_week',-1))")"
EMAIL_LINKED="$(echo "$CTX" | python3 -c "import sys,json; print(json.load(sys.stdin).get('email_client_linked',False))")"
if [[ "$SCHED_WEEK" == "-1" ]]; then
  echo "FAIL context missing scheduled_this_week"
  exit 1
fi
echo "OK context scheduled_this_week=$SCHED_WEEK email_client_linked=$EMAIL_LINKED"

DIFF="$(curl -sf "${AUTH[@]}" "$BASE/plan-snapshot/drift-diff")"
HAS_PILLARS="$(echo "$DIFF" | python3 -c "import sys,json; d=json.load(sys.stdin); print('pillars' in d and 'calendar' in d)")"
if [[ "$HAS_PILLARS" != "True" ]]; then
  echo "FAIL drift-diff shape"
  exit 1
fi
echo "OK drift-diff endpoint"

QUEUE="$(curl -sf "${AUTH[@]}" "$BASE/review-queue")"
FIRST_BREACH="$(echo "$QUEUE" | python3 -c "
import sys, json
items = json.load(sys.stdin).get('items') or []
breach = [i for i in items if i.get('sla_breach')]
if not breach:
  print('skip')
  sys.exit(0)
if items and items[0].get('sla_breach'):
  print('ok')
else:
  print('fail')
")"
if [[ "$FIRST_BREACH" == "fail" ]]; then
  echo "FAIL review queue SLA breach not first"
  exit 1
fi
echo "OK review queue sort (breach-first when present)"

SUMMARY="$(curl -sf "${AUTH[@]}" "$BASE/review-queue/summary")"
TARGET="$(echo "$SUMMARY" | python3 -c "import sys,json; print(json.load(sys.stdin).get('sla_target_hours',0))")"
if [[ "$TARGET" != "48" ]]; then
  echo "FAIL review summary missing sla_target_hours"
  exit 1
fi
echo "OK review summary SLA tile fields"

echo "PASS M13 smoke"
