#!/usr/bin/env bash
# Smoke P2 — AI media: carousel slides + visual QA + visual approve gate
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
echo "==> P2 media smoke lifecycle #$LIFECYCLE_ID"

CTX="$(curl -sf "${AUTH[@]}" "$BASE/context")"
MEDIA="$(echo "$CTX" | python3 -c "import sys,json; f=json.load(sys.stdin).get('flags') or {}; print('1' if f.get('media_enabled') and f.get('image_gen_enabled') else '0')")"
if [[ "$MEDIA" != "1" ]]; then
  echo "FAIL media flags off — set PTT_CONTENT_MARKETING_MEDIA_ENABLED=1 PTT_CMKT_IMAGE_GEN=1"
  exit 1
fi

CAR_JSON="$(curl -sf "${AUTH[@]}" -H 'Content-Type: application/json' \
  -d '{"title":"P2 carousel media","channel":"facebook","format":"carousel","body_json":{"markdown":"Slide one hook\nSlide two value\nSlide three CTA"}}' \
  -X POST "$BASE/items")"
CAR_ID="$(echo "$CAR_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")"

curl -sf "${AUTH[@]}" -X POST "$BASE/items/$CAR_ID/submit-review" >/dev/null
curl -sf "${AUTH[@]}" -X POST "$BASE/items/$CAR_ID/approve" >/dev/null

JOB="$(curl -sf "${AUTH[@]}" -H 'Content-Type: application/json' \
  -d '{"style_preset":"corporate","aspect_ratio":"1:1"}' \
  -X POST "$BASE/items/$CAR_ID/jobs/carousel-slides")"
JOB_STATUS="$(echo "$JOB" | python3 -c "import sys,json; print(json.load(sys.stdin).get('status',''))")"
if [[ "$JOB_STATUS" != "done" && "$JOB_STATUS" != "completed" && "$JOB_STATUS" != "succeeded" ]]; then
  echo "FAIL carousel job status=$JOB_STATUS"
  exit 1
fi

curl -sf "${AUTH[@]}" -H 'Content-Type: application/json' -d '{}' \
  -X POST "$BASE/items/$CAR_ID/jobs/visual-qa" >/dev/null

ITEM="$(curl -sf "${AUTH[@]}" "$BASE/items/$CAR_ID")"
CDN_OK="$(echo "$ITEM" | python3 -c "
import sys, json
m = json.load(sys.stdin).get('media_json') or {}
slides = m.get('carousel_slides') or []
if not slides:
  print('0')
  raise SystemExit
for s in slides:
  url = str(s.get('url') or '')
  if 'picsum.photos' in url or 'placeholder.com' in url:
    print('0')
    raise SystemExit
  if '/cmkt/' not in url and 'cdn.' not in url:
    print('0')
    raise SystemExit
print('1')
")"
if [[ "$CDN_OK" != "1" ]]; then
  echo "FAIL carousel URLs must use CDN (no picsum)"
  exit 1
fi

VS="$(echo "$ITEM" | python3 -c "import sys,json; print(json.load(sys.stdin).get('visual_status',''))")"
SLIDES="$(echo "$ITEM" | python3 -c "import sys,json; m=json.load(sys.stdin).get('media_json') or {}; print(len(m.get('carousel_slides') or []))")"
if [[ "$SLIDES" -lt 1 ]]; then
  echo "FAIL no carousel_slides generated"
  exit 1
fi
if [[ "$VS" != "ai_ready" ]]; then
  echo "FAIL visual_status=$VS expected ai_ready"
  exit 1
fi

curl -sf "${AUTH[@]}" -X POST "$BASE/items/$CAR_ID/visual/submit-review" >/dev/null

QUEUE="$(curl -sf "${AUTH[@]}" "$BASE/visual-review-queue")"
QCOUNT="$(echo "$QUEUE" | python3 -c "import sys,json; print(len(json.load(sys.stdin).get('items') or []))")"
if [[ "$QCOUNT" -lt 1 ]]; then
  echo "FAIL visual-review-queue empty"
  exit 1
fi

PUBLISH_CODE="$(curl -s -o /dev/null -w '%{http_code}' "${AUTH[@]}" -H 'Content-Type: application/json' \
  -d '{"published_url":"https://example.com/p2-smoke"}' \
  -X POST "$BASE/items/$CAR_ID/publish")"
if [[ "$PUBLISH_CODE" == "200" || "$PUBLISH_CODE" == "201" ]]; then
  echo "FAIL publish should be blocked before visual approve (got $PUBLISH_CODE)"
  exit 1
fi

curl -sf "${AUTH[@]}" -H 'Content-Type: application/json' -d '{"override":true}' \
  -X POST "$BASE/items/$CAR_ID/visual/approve" >/dev/null

ITEM2="$(curl -sf "${AUTH[@]}" "$BASE/items/$CAR_ID")"
VS2="$(echo "$ITEM2" | python3 -c "import sys,json; print(json.load(sys.stdin).get('visual_status',''))")"
if [[ "$VS2" != "approved" ]]; then
  echo "FAIL visual_status after approve=$VS2"
  exit 1
fi

curl -sf "${AUTH[@]}" -H 'Content-Type: application/json' \
  -d '{"published_url":"https://example.com/p2-smoke-carousel"}' \
  -X POST "$BASE/items/$CAR_ID/publish" >/dev/null

echo "PASS P2 media smoke — carousel #$CAR_ID visual approved + published"
