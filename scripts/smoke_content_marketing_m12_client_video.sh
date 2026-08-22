#!/usr/bin/env bash
# Smoke M12 — client gate transitions, portal content-summary, video_short_generate stub
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
echo "==> M12 client gate + video smoke lifecycle #$LIFECYCLE_ID"

CTX="$(curl -sf "${AUTH[@]}" "$BASE/context")"
CLIENT_GATE="$(echo "$CTX" | python3 -c "import sys,json; print(json.load(sys.stdin).get('flags',{}).get('client_gate',False))")"
VIDEO_GEN="$(echo "$CTX" | python3 -c "import sys,json; print(json.load(sys.stdin).get('flags',{}).get('video_gen_enabled',False))")"

ITEM_JSON="$(curl -sf "${AUTH[@]}" -H 'Content-Type: application/json' \
  -d '{"title":"M12 video smoke","channel":"short_video","format":"video_script","body_json":{"markdown":"Hook 3s · beat · CTA"}}' \
  -X POST "$BASE/items")"
ITEM_ID="$(echo "$ITEM_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")"

curl -sf "${AUTH[@]}" -X POST "$BASE/items/$ITEM_ID/submit-review" >/dev/null
curl -sf "${AUTH[@]}" -X POST "$BASE/items/$ITEM_ID/approve" >/dev/null

if [[ "$CLIENT_GATE" == "True" || "$CLIENT_GATE" == "true" ]]; then
  PENDING="$(curl -sf "${AUTH[@]}" -X POST "$BASE/items/$ITEM_ID/submit-client")"
  STATUS="$(echo "$PENDING" | python3 -c "import sys,json; print(json.load(sys.stdin).get('status',''))")"
  if [[ "$STATUS" != "pending_client" ]]; then
    echo "FAIL submit-client status=$STATUS"
    exit 1
  fi
  APPROVED="$(curl -sf "${AUTH[@]}" -X POST "$BASE/items/$ITEM_ID/client-approve")"
  AST="$(echo "$APPROVED" | python3 -c "import sys,json; print(json.load(sys.stdin).get('status',''))")"
  if [[ "$AST" != "client_approved" ]]; then
    echo "FAIL client-approve status=$AST"
    exit 1
  fi
  echo "OK client gate transitions"
else
  echo "WARN client_gate off — enable PTT_CONTENT_MARKETING_CLIENT_GATE=1 for full M12-1 pass"
fi

if [[ "$VIDEO_GEN" == "True" || "$VIDEO_GEN" == "true" ]]; then
  JOB="$(curl -sf "${AUTH[@]}" -H 'Content-Type: application/json' -d '{"aspect_ratio":"9:16"}' -X POST "$BASE/items/$ITEM_ID/jobs/video-short")"
  JOB_STATUS="$(echo "$JOB" | python3 -c "import sys,json; print(json.load(sys.stdin).get('status',''))")"
  if [[ "$JOB_STATUS" != "succeeded" ]]; then
    echo "FAIL video-short status=$JOB_STATUS"
    exit 1
  fi
  echo "OK video_short_generate job"
else
  echo "WARN video_gen off — enable PTT_CMKT_VIDEO_GEN=1 for full M12-3 pass"
fi

PORTAL_TOKEN="${PORTAL_JWT:-}"
if [[ -n "$PORTAL_TOKEN" ]]; then
  SUMMARY="$(curl -sf -H "Authorization: Bearer $PORTAL_TOKEN" "$API_BASE/api/v1/portal/service-lifecycle/$LIFECYCLE_ID/content-summary" 2>/dev/null || true)"
  if [[ -n "$SUMMARY" ]]; then
    ENABLED="$(echo "$SUMMARY" | python3 -c "import sys,json; print(json.load(sys.stdin).get('enabled',False))" 2>/dev/null || echo false)"
    echo "portal_summary_enabled=$ENABLED"
  fi
else
  echo "SKIP portal summary — set PORTAL_JWT to verify GET /content-summary"
fi

echo "PASS M12 smoke — item #$ITEM_ID"
