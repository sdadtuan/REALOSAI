#!/usr/bin/env bash
# M16 — governance: brief gate, PII consent context, regenerate endpoint
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
echo "==> M16 governance smoke lifecycle #$LIFECYCLE_ID"

CTX="$(curl -sf "${AUTH[@]}" "$BASE/context")"
BRIEF_GATE="$(echo "$CTX" | python3 -c "import sys,json; print('yes' if json.load(sys.stdin).get('flags',{}).get('brief_gate_enabled') else 'no')")"
PII_FLAG="$(echo "$CTX" | python3 -c "import sys,json; print(json.load(sys.stdin).get('flags',{}).get('pii_consent'))")"
if [[ "$BRIEF_GATE" != "yes" ]]; then
  echo "FAIL context missing brief_gate_enabled"
  exit 1
fi
echo "OK context flags brief_gate=$BRIEF_GATE pii_consent=$PII_FLAG"

IDEA_JSON="$(curl -sf "${AUTH[@]}" -H 'Content-Type: application/json' \
  -d '{"title":"M16 smoke idea","hook":"hook","target_goal":"engagement"}' -X POST "$BASE/ideas")"
IDEA_ID="$(echo "$IDEA_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")"
CONV_JSON="$(curl -sf "${AUTH[@]}" -H 'Content-Type: application/json' \
  -d '{"channel":"facebook","format":"social_post"}' -X POST "$BASE/ideas/$IDEA_ID/convert")"
ITEM_ID="$(echo "$CONV_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin)['item']['id'])")"

BRIEF_HTTP="$(curl -s -o /tmp/cmkt-m16-brief.json -w '%{http_code}' "${AUTH[@]}" \
  -H 'Content-Type: application/json' -d '{"tone":"professional_friendly"}' \
  -X POST "$BASE/items/$ITEM_ID/jobs/draft")"
if [[ "$BRIEF_HTTP" != "400" ]]; then
  echo "FAIL expected brief_incomplete http=400 got=$BRIEF_HTTP"
  cat /tmp/cmkt-m16-brief.json || true
  exit 1
fi
BRIEF_ERR="$(python3 -c "import json; print(json.load(open('/tmp/cmkt-m16-brief.json')).get('error',''))")"
if [[ "$BRIEF_ERR" != "brief_incomplete" ]]; then
  echo "FAIL brief gate error=$BRIEF_ERR"
  exit 1
fi
echo "OK brief_incomplete gate"

curl -sf "${AUTH[@]}" -H 'Content-Type: application/json' \
  -d '{"funnel_goal":"engagement","brief_json":{"audience":"B2B marketers","hook":"hook"}}' \
  -X PATCH "$BASE/items/$ITEM_ID" >/dev/null

DRAFT_JOB="$(curl -sf "${AUTH[@]}" -H 'Content-Type: application/json' \
  -d '{"tone":"professional_friendly","goal":"engagement"}' \
  -X POST "$BASE/items/$ITEM_ID/jobs/draft")"
DRAFT_STATUS="$(echo "$DRAFT_JOB" | python3 -c "import sys,json; print(json.load(sys.stdin).get('status',''))")"
if [[ "$DRAFT_STATUS" != "succeeded" ]]; then
  echo "FAIL draft job status=$DRAFT_STATUS"
  exit 1
fi
echo "OK draft after brief supplement"

REGEN_JOB="$(curl -sf "${AUTH[@]}" -H 'Content-Type: application/json' \
  -d '{"mode":"rewrite","reason":"sai tone","goal":"engagement"}' \
  -X POST "$BASE/items/$ITEM_ID/jobs/regenerate")"
REGEN_TYPE="$(echo "$REGEN_JOB" | python3 -c "import sys,json; print(json.load(sys.stdin).get('job_type',''))")"
REGEN_STATUS="$(echo "$REGEN_JOB" | python3 -c "import sys,json; print(json.load(sys.stdin).get('status',''))")"
if [[ "$REGEN_TYPE" != "regenerate" || "$REGEN_STATUS" != "succeeded" ]]; then
  echo "FAIL regenerate job type=$REGEN_TYPE status=$REGEN_STATUS"
  exit 1
fi
echo "OK regenerate job succeeded"

echo "M16 governance smoke PASS"
