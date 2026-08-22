#!/usr/bin/env bash
# Smoke M1 — idea → convert → patch body
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
if not pref:
  pref = [x for x in ls if str(x.get('stage','')) in ('onboard','deliver')]
pick = pref[0] if pref else (ls[0] if ls else None)
print(pick['id'] if pick else '')
" 2>/dev/null || true
  )"
fi
if [[ -z "$LIFECYCLE_ID" ]]; then
  echo "FAIL set LIFECYCLE_ID (pilot slug tiep-thi-noi-dung)"
  exit 1
fi

BASE="$API_BASE/api/crm/service-lifecycle/$LIFECYCLE_ID/content-marketing"
echo "==> M1 smoke lifecycle #$LIFECYCLE_ID"

IDEA_JSON="$(curl -sf "${AUTH[@]}" -H 'Content-Type: application/json' \
  -d '{"title":"Smoke idea M1","hook":"hook test"}' \
  -X POST "$BASE/ideas")"
IDEA_ID="$(echo "$IDEA_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")"
echo "Created idea #$IDEA_ID"

CONV_JSON="$(curl -sf "${AUTH[@]}" -H 'Content-Type: application/json' \
  -d '{"channel":"facebook","format":"social_post"}' \
  -X POST "$BASE/ideas/$IDEA_ID/convert")"
ITEM_ID="$(echo "$CONV_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin)['item']['id'])")"
echo "Converted item #$ITEM_ID"

PATCH_JSON="$(curl -sf "${AUTH[@]}" -H 'Content-Type: application/json' \
  -d '{"body_json":{"markdown":"Smoke body M1","html":"","variants":[]}}' \
  -X PATCH "$BASE/items/$ITEM_ID")"
MD="$(echo "$PATCH_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin).get('body_json',{}).get('markdown',''))")"
if [[ "$MD" != "Smoke body M1" ]]; then
  echo "FAIL body not persisted: $MD"
  exit 1
fi

HTTP="$(curl -sS -o /tmp/cmkt-invalid.json -w "%{http_code}" "${AUTH[@]}" -H 'Content-Type: application/json' \
  -d '{"title":"Bad","channel":"facebook","format":"blog"}' \
  -X POST "$BASE/items")"
if [[ "$HTTP" != "400" ]]; then
  echo "FAIL expected 400 for invalid channel+format, got $HTTP"
  exit 1
fi

echo "OK  smoke_content_marketing_m1 passed (idea $IDEA_ID → item $ITEM_ID)"
