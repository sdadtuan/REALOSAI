#!/usr/bin/env bash
# Smoke M15 — advanced media: OCR/ΔE QA, clean asset on approve, video pipeline
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
echo "==> M15 media advanced smoke lifecycle #$LIFECYCLE_ID"

ITEM_JSON="$(curl -sf "${AUTH[@]}" -H 'Content-Type: application/json' \
  -d '{"title":"M15 media smoke","channel":"facebook","format":"social_post","body_json":{"markdown":"Headline cho carousel test"}}' \
  -X POST "$BASE/items")"
ITEM_ID="$(echo "$ITEM_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")"

curl -sf "${AUTH[@]}" -X POST "$BASE/items/$ITEM_ID/submit-review" >/dev/null
curl -sf "${AUTH[@]}" -X POST "$BASE/items/$ITEM_ID/approve" >/dev/null

IMG_JOB="$(curl -sf "${AUTH[@]}" -H 'Content-Type: application/json' -d '{"variant_count":1}' -X POST "$BASE/items/$ITEM_ID/jobs/image")"
IMG_STATUS="$(echo "$IMG_JOB" | python3 -c "import sys,json; print(json.load(sys.stdin).get('status',''))")"
if [[ "$IMG_STATUS" != "succeeded" ]]; then
  echo "FAIL image job status=$IMG_STATUS"
  exit 1
fi

ITEM="$(curl -sf "${AUTH[@]}" "$BASE/items/$ITEM_ID")"
OCR="$(echo "$ITEM" | python3 -c "import sys,json; i=json.load(sys.stdin); print(i.get('media_json',{}).get('visual_qa',{}).get('ocr_confidence',0))")"
DELTA="$(echo "$ITEM" | python3 -c "import sys,json; i=json.load(sys.stdin); v=i.get('media_json',{}).get('visual_qa',{}).get('brand_delta_e_max'); print(v if v is not None else 'null')")"
if [[ "$OCR" == "0" || "$OCR" == "0.0" ]]; then
  echo "WARN ocr_confidence missing — check sharp/runtime"
fi

curl -sf "${AUTH[@]}" -X POST "$BASE/items/$ITEM_ID/visual/submit-review" >/dev/null || true
APPROVED="$(curl -sf "${AUTH[@]}" -H 'Content-Type: application/json' -d '{"override":true}' -X POST "$BASE/items/$ITEM_ID/visual/approve")"
DRAFT="$(echo "$APPROVED" | python3 -c "import sys,json; a=(json.load(sys.stdin).get('media_json',{}).get('ai_assets') or [{}])[0]; print('yes' if a.get('draft_watermark') else 'no')")"
if [[ "$DRAFT" == "yes" ]]; then
  echo "FAIL clean asset — draft_watermark still true after approve"
  exit 1
fi

VIDEO_ITEM_JSON="$(curl -sf "${AUTH[@]}" -H 'Content-Type: application/json' \
  -d '{"title":"M15 video smoke","channel":"short_video","format":"video_script","body_json":{"markdown":"Hook 3 giây\nBeat 1\nCTA cuối"}}' \
  -X POST "$BASE/items")"
VIDEO_ITEM_ID="$(echo "$VIDEO_ITEM_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")"
curl -sf "${AUTH[@]}" -X POST "$BASE/items/$VIDEO_ITEM_ID/submit-review" >/dev/null
curl -sf "${AUTH[@]}" -X POST "$BASE/items/$VIDEO_ITEM_ID/approve" >/dev/null
VIDEO_JOB="$(curl -sf "${AUTH[@]}" -H 'Content-Type: application/json' -d '{}' -X POST "$BASE/items/$VIDEO_ITEM_ID/jobs/video-short")"
VIDEO_STATUS="$(echo "$VIDEO_JOB" | python3 -c "import sys,json; print(json.load(sys.stdin).get('status',''))")"
if [[ "$VIDEO_STATUS" != "succeeded" ]]; then
  echo "FAIL video-short status=$VIDEO_STATUS"
  exit 1
fi

echo "PASS M15 media advanced — item #$ITEM_ID OCR=$OCR ΔE=$DELTA clean approve OK; video item #$VIDEO_ITEM_ID"
