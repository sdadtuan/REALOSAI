#!/usr/bin/env bash
# Smoke P0 — full Content Marketing workflow gate
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
echo "==> P0 smoke lifecycle #$LIFECYCLE_ID"

curl -sf "${AUTH[@]}" "$BASE/context" >/dev/null

IDEA_JSON="$(curl -sf "${AUTH[@]}" -H 'Content-Type: application/json' \
  -d '{"title":"P0 smoke idea","hook":"hook"}' -X POST "$BASE/ideas")"
IDEA_ID="$(echo "$IDEA_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")"
CONV_JSON="$(curl -sf "${AUTH[@]}" -H 'Content-Type: application/json' \
  -d '{"channel":"facebook","format":"social_post"}' -X POST "$BASE/ideas/$IDEA_ID/convert")"
ITEM_ID="$(echo "$CONV_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin)['item']['id'])")"

curl -sf "${AUTH[@]}" -H 'Content-Type: application/json' \
  -d '{"tone":"professional_friendly"}' -X POST "$BASE/items/$ITEM_ID/jobs/draft" >/dev/null

SUBMIT="$(curl -sf "${AUTH[@]}" -X POST "$BASE/items/$ITEM_ID/submit-review")"
STATUS="$(echo "$SUBMIT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('status',''))")"
if [[ "$STATUS" != "in_review" ]]; then
  echo "FAIL submit-review status=$STATUS"
  exit 1
fi

APPROVE="$(curl -sf "${AUTH[@]}" -X POST "$BASE/items/$ITEM_ID/approve")"
if [[ "$(echo "$APPROVE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('status',''))")" != "approved_internal" ]]; then
  echo "FAIL approve"
  exit 1
fi

SCHEDULE_AT="$(python3 -c "from datetime import datetime, timedelta, timezone; print((datetime.now(timezone.utc)+timedelta(days=2)).strftime('%Y-%m-%dT10:00:00Z'))")"
curl -sf "${AUTH[@]}" -H 'Content-Type: application/json' \
  -d "{\"scheduled_at\":\"$SCHEDULE_AT\"}" \
  -X PUT "$BASE/calendar/slots/$ITEM_ID" >/dev/null

PUBLISH="$(curl -sf "${AUTH[@]}" -H 'Content-Type: application/json' \
  -d '{"published_url":"https://example.com/p0-smoke"}' -X POST "$BASE/items/$ITEM_ID/publish")"
if [[ "$(echo "$PUBLISH" | python3 -c "import sys,json; print(json.load(sys.stdin).get('status',''))")" != "published" ]]; then
  echo "FAIL publish"
  exit 1
fi

AUDIT_COUNT="$(curl -sf "${AUTH[@]}" "$BASE/audit?limit=20" | python3 -c "import sys,json; print(len(json.load(sys.stdin).get('audit') or []))")"
if [[ "$AUDIT_COUNT" -le 0 ]]; then
  echo "FAIL audit empty"
  exit 1
fi

HTTP="$(curl -sS -o /tmp/cmkt-reject.json -w "%{http_code}" "${AUTH[@]}" -H 'Content-Type: application/json' \
  -d '{"comment":"short"}' -X POST "$BASE/items/$ITEM_ID/reject")"
if [[ "$HTTP" != "400" ]]; then
  echo "WARN reject without comment expected 400 got $HTTP (item already published)"
fi

echo "OK  smoke_content_marketing_p0 passed (item $ITEM_ID, audit rows $AUDIT_COUNT)"
