#!/usr/bin/env bash
# Smoke — Social video FFmpeg V1: lock-studio → storyboard → render → MP4 URL
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
SMOKE_SKIP_FFMPEG="${SMOKE_SKIP_FFMPEG:-0}"

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
echo "==> Social video FFmpeg V1 smoke lifecycle #$LIFECYCLE_ID"

FFMPEG_OK=0
if ffmpeg -version >/dev/null 2>&1; then
  FFMPEG_OK=1
  echo "OK ffmpeg available locally"
elif [[ "$SMOKE_SKIP_FFMPEG" == "1" ]]; then
  echo "SKIP ffmpeg missing locally — will skip render later if needed"
else
  echo "WARN ffmpeg missing locally — will try lock+storyboard; render may fail on server"
fi

CTX="$(curl -sf "${AUTH[@]}" "$BASE/context")"
VIDEO_GEN="$(echo "$CTX" | python3 -c "import sys,json; f=json.load(sys.stdin).get('flags') or {}; print('1' if f.get('video_gen_enabled') else '0')")"
if [[ "$VIDEO_GEN" != "1" ]]; then
  echo "FAIL video_gen off — set PTT_CMKT_VIDEO_GEN=1 PTT_CMKT_VIDEO_SOCIAL=1"
  exit 1
fi

ITEM_JSON="$(curl -sf "${AUTH[@]}" -H 'Content-Type: application/json' \
  -d '{"title":"Social FFmpeg V1 smoke","channel":"short_video","format":"video_script","body_json":{"markdown":"Hook 3 giây · beat giá trị · CTA cuối"}}' \
  -X POST "$BASE/items")"
ITEM_ID="$(echo "$ITEM_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")"

curl -sf "${AUTH[@]}" -X POST "$BASE/items/$ITEM_ID/submit-review" >/dev/null
curl -sf "${AUTH[@]}" -X POST "$BASE/items/$ITEM_ID/approve" >/dev/null

curl -sf "${AUTH[@]}" -H 'Content-Type: application/json' \
  -d '{"studio":"social"}' \
  -X POST "$BASE/items/$ITEM_ID/video/lock-studio" >/dev/null

STORY_JOB="$(curl -sf "${AUTH[@]}" -H 'Content-Type: application/json' \
  -d '{"pack_default":"reels"}' \
  -X POST "$BASE/items/$ITEM_ID/jobs/video-storyboard")"
STORY_JOB_ID="$(echo "$STORY_JOB" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")"

poll_job() {
  local job_id="$1"
  local attempts="${2:-60}"
  local job_json status error_text
  for ((i = 0; i < attempts; i++)); do
    job_json="$(curl -sf "${AUTH[@]}" "$BASE/jobs/$job_id")"
    status="$(echo "$job_json" | python3 -c "import sys,json; print(json.load(sys.stdin).get('status',''))")"
    error_text="$(echo "$job_json" | python3 -c "import sys,json; print(json.load(sys.stdin).get('error_text','') or '')")"
    case "$status" in
      succeeded|failed|done|completed)
        printf '%s' "$job_json"
        return 0
        ;;
    esac
    sleep 1.5
  done
  echo "FAIL job #$job_id poll timeout last_status=$status" >&2
  exit 1
}

STORY_DONE="$(poll_job "$STORY_JOB_ID")"
STORY_STATUS="$(echo "$STORY_DONE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('status',''))")"
STORY_ERROR="$(echo "$STORY_DONE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('error_text','') or '')")"

if [[ "$STORY_STATUS" == "failed" ]]; then
  if [[ "$STORY_ERROR" == *ffmpeg_missing* && "$SMOKE_SKIP_FFMPEG" == "1" ]]; then
    echo "SKIP render — storyboard failed ffmpeg_missing (SMOKE_SKIP_FFMPEG=1)"
    exit 0
  fi
  echo "FAIL storyboard job status=$STORY_STATUS error=$STORY_ERROR"
  exit 1
fi

if [[ "$FFMPEG_OK" != "1" || "$SMOKE_SKIP_FFMPEG" == "1" ]]; then
  echo "SKIP render — ffmpeg unavailable locally or SMOKE_SKIP_FFMPEG=1 (storyboard OK)"
  exit 0
fi

RENDER_JOB="$(curl -sf "${AUTH[@]}" -H 'Content-Type: application/json' \
  -d '{"pack_default":"reels"}' \
  -X POST "$BASE/items/$ITEM_ID/jobs/video-render")"
RENDER_JOB_ID="$(echo "$RENDER_JOB" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")"

RENDER_DONE="$(poll_job "$RENDER_JOB_ID")"
RENDER_STATUS="$(echo "$RENDER_DONE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('status',''))")"
RENDER_ERROR="$(echo "$RENDER_DONE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('error_text','') or '')")"

if [[ "$RENDER_STATUS" == "failed" ]]; then
  if [[ "$RENDER_ERROR" == *ffmpeg_missing* && "$SMOKE_SKIP_FFMPEG" == "1" ]]; then
    echo "SKIP render — ffmpeg_missing (SMOKE_SKIP_FFMPEG=1)"
    exit 0
  fi
  echo "FAIL render job status=$RENDER_STATUS error=$RENDER_ERROR"
  exit 1
fi

ITEM="$(curl -sf "${AUTH[@]}" "$BASE/items/$ITEM_ID")"
VIDEO_URL="$(echo "$ITEM" | python3 -c "
import sys, json
url = str((json.load(sys.stdin).get('media_json') or {}).get('video_short', {}).get('url') or '')
print(url)
")"

if [[ -z "$VIDEO_URL" ]]; then
  echo "FAIL video_short.url missing after render"
  exit 1
fi
if [[ ! "$VIDEO_URL" =~ \.mp4$ ]]; then
  echo "FAIL video_short.url must end with .mp4 got=$VIDEO_URL"
  exit 1
fi

if curl -sfI "$VIDEO_URL" >/dev/null 2>&1; then
  CT="$(curl -sfI "$VIDEO_URL" | grep -i '^content-type:' | head -1 || true)"
  if echo "$CT" | grep -qi 'json'; then
    echo "FAIL video URL Content-Type looks like JSON: $CT"
    exit 1
  fi
  BODY_START="$(curl -sf --range 0-3 "$VIDEO_URL" 2>/dev/null || true)"
  if [[ "$BODY_START" == "{"* ]]; then
    echo "FAIL video URL body starts with JSON"
    exit 1
  fi
fi

echo "OK Social video FFmpeg V1 smoke — item #$ITEM_ID video_short.url=$VIDEO_URL"
