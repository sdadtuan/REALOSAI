#!/usr/bin/env bash
# Smoke M3 — draft job + variants job + version history
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
echo "==> M3 smoke lifecycle #$LIFECYCLE_ID"

CTX="$(curl -sf "${AUTH[@]}" "$BASE/context")"
AI_ON="$(echo "$CTX" | python3 -c "import sys,json; print('1' if json.load(sys.stdin).get('flags',{}).get('ai_enabled') else '0')")"
if [[ "$AI_ON" != "1" ]]; then
  echo "FAIL PTT_CONTENT_MARKETING_AI_ENABLED must be 1"
  exit 1
fi

IDEA_JSON="$(curl -sf "${AUTH[@]}" -H 'Content-Type: application/json' \
  -d '{"title":"Smoke M3 idea","hook":"hook"}' \
  -X POST "$BASE/ideas")"
IDEA_ID="$(echo "$IDEA_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")"
CONV_JSON="$(curl -sf "${AUTH[@]}" -H 'Content-Type: application/json' \
  -d '{"channel":"facebook","format":"social_post"}' \
  -X POST "$BASE/ideas/$IDEA_ID/convert")"
ITEM_ID="$(echo "$CONV_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin)['item']['id'])")"
echo "Item #$ITEM_ID"

DRAFT_JOB="$(curl -sf "${AUTH[@]}" -H 'Content-Type: application/json' \
  -d '{"tone":"professional_friendly","length":"medium","goal":"engagement"}' \
  -X POST "$BASE/items/$ITEM_ID/jobs/draft")"
DRAFT_STATUS="$(echo "$DRAFT_JOB" | python3 -c "import sys,json; print(json.load(sys.stdin).get('status',''))")"
MD="$(curl -sf "${AUTH[@]}" "$BASE/items/$ITEM_ID" | python3 -c "import sys,json; print(json.load(sys.stdin).get('body_json',{}).get('markdown',''))")"
if [[ "$DRAFT_STATUS" != "succeeded" || -z "$MD" ]]; then
  echo "FAIL draft job status=$DRAFT_STATUS markdown_len=${#MD}"
  exit 1
fi
echo "Draft OK (${#MD} chars)"

VAR_JOB="$(curl -sf "${AUTH[@]}" -H 'Content-Type: application/json' \
  -d '{"variant_count":3,"goal":"engagement"}' \
  -X POST "$BASE/items/$ITEM_ID/jobs/variants")"
VAR_STATUS="$(echo "$VAR_JOB" | python3 -c "import sys,json; print(json.load(sys.stdin).get('status',''))")"
VAR_COUNT="$(curl -sf "${AUTH[@]}" "$BASE/items/$ITEM_ID" | python3 -c "import sys,json; print(len(json.load(sys.stdin).get('body_json',{}).get('variants') or []))")"
if [[ "$VAR_STATUS" != "succeeded" || "$VAR_COUNT" -lt 3 ]]; then
  echo "FAIL variants status=$VAR_STATUS count=$VAR_COUNT"
  exit 1
fi
echo "Variants OK ($VAR_COUNT)"

VERS="$(curl -sf "${AUTH[@]}" "$BASE/items/$ITEM_ID/versions")"
VNO="$(echo "$VERS" | python3 -c "import sys,json; vs=json.load(sys.stdin).get('versions') or []; print(max([v.get('version_no',0) for v in vs] or [0]))")"
if [[ "$VNO" -lt 2 ]]; then
  echo "FAIL expected version_no >= 2, got $VNO"
  exit 1
fi

echo "OK  smoke_content_marketing_m3 passed (item $ITEM_ID, versions max=$VNO)"
