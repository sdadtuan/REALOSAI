#!/usr/bin/env bash
# M8 — Content Marketing governance smoke (assign, comments, version diff)
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
ASSIGNEE_SP="${ASSIGNEE_SP:-1}"

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
echo "==> M8 governance smoke lifecycle #$LIFECYCLE_ID"

IDEA_JSON="$(curl -sf "${AUTH[@]}" -H 'Content-Type: application/json' \
  -d '{"title":"M8 smoke idea","hook":"hook"}' -X POST "$BASE/ideas")"
IDEA_ID="$(echo "$IDEA_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")"
CONV_JSON="$(curl -sf "${AUTH[@]}" -H 'Content-Type: application/json' \
  -d '{"channel":"facebook","format":"social_post"}' -X POST "$BASE/ideas/$IDEA_ID/convert")"
ITEM_ID="$(echo "$CONV_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin)['item']['id'])")"

ASSIGN_HTTP="$(curl -s -o /tmp/cmkt-m8-assign.json -w '%{http_code}' "${AUTH[@]}" \
  -H 'Content-Type: application/json' \
  -d "{\"assignee_sp\":$ASSIGNEE_SP,\"assignee_qa\":null}" \
  -X PATCH "$BASE/items/$ITEM_ID/assignees")"
if [[ "$ASSIGN_HTTP" != "200" ]]; then
  echo "WARN assign PATCH http=$ASSIGN_HTTP (need crm_content.assign cap) — body:"
  cat /tmp/cmkt-m8-assign.json || true
else
  SP="$(python3 -c "import json; print(json.load(open('/tmp/cmkt-m8-assign.json')).get('assignee_sp'))")"
  echo "OK assignee_sp=$SP"
fi

COMMENT_JSON="$(curl -sf "${AUTH[@]}" -H 'Content-Type: application/json' \
  -d '{"body":"M8 smoke comment — QA thread test."}' -X POST "$BASE/items/$ITEM_ID/comments")"
COMMENT_ID="$(echo "$COMMENT_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin)['comment']['id'])")"
LIST_JSON="$(curl -sf "${AUTH[@]}" "$BASE/items/$ITEM_ID/comments")"
COUNT="$(echo "$LIST_JSON" | python3 -c "import sys,json; print(len(json.load(sys.stdin).get('comments',[])))")"
if [[ "$COUNT" -lt 1 ]]; then
  echo "FAIL comments list empty"
  exit 1
fi
echo "OK comment #$COMMENT_ID listed ($COUNT rows)"

curl -sf "${AUTH[@]}" -H 'Content-Type: application/json' \
  -d '{"body_json":{"markdown":"version A line"}}' -X PATCH "$BASE/items/$ITEM_ID" >/dev/null
curl -sf "${AUTH[@]}" -H 'Content-Type: application/json' \
  -d '{"body_json":{"markdown":"version B line"}}' -X PATCH "$BASE/items/$ITEM_ID" >/dev/null

VERSIONS="$(curl -sf "${AUTH[@]}" "$BASE/items/$ITEM_ID/versions")"
V1="$(echo "$VERSIONS" | python3 -c "
import sys,json
vs=sorted(json.load(sys.stdin).get('versions',[]), key=lambda x: x['version_no'])
print(vs[-2]['version_no'] if len(vs)>=2 else '')
")"
V2="$(echo "$VERSIONS" | python3 -c "
import sys,json
vs=sorted(json.load(sys.stdin).get('versions',[]), key=lambda x: x['version_no'])
print(vs[-1]['version_no'] if len(vs)>=2 else '')
")"
if [[ -z "$V1" || -z "$V2" ]]; then
  echo "FAIL need >=2 versions for diff"
  exit 1
fi

DIFF_JSON="$(curl -sf "${AUTH[@]}" "$BASE/items/$ITEM_ID/versions/compare?v1=$V1&v2=$V2")"
LINES="$(echo "$DIFF_JSON" | python3 -c "import sys,json; print(len(json.load(sys.stdin).get('lines',[])))")"
if [[ "$LINES" -lt 1 ]]; then
  echo "FAIL version compare empty"
  exit 1
fi
echo "OK version compare v$V1→v$V2 ($LINES diff lines)"

echo "M8 governance smoke PASS"
