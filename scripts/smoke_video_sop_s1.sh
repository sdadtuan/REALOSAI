#!/usr/bin/env bash
# Smoke — Video SOP S1: create cinematic project and block social jobs
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
if [[ -f "$ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env"
  set +a
fi

if [[ "${PTT_CMKT_VIDEO_CINEMATIC:-0}" != "1" ]]; then
  echo "SKIP cinematic off"
  exit 0
fi

API_BASE="${PTT_API_URL:-http://127.0.0.1:3000}"
LIFECYCLE_ID="${LIFECYCLE_ID:-3}"
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

BASE="$API_BASE/api/crm/service-lifecycle/$LIFECYCLE_ID/content-marketing"
echo "==> Video SOP S1 smoke lifecycle #$LIFECYCLE_ID"

ITEM_JSON="$(curl -sf "${AUTH[@]}" -H 'Content-Type: application/json' \
  -d '{"title":"Video SOP S1 smoke","channel":"short_video","format":"video_script","body_json":{"markdown":"Hook 3 giây · beat giá trị · CTA cuối"}}' \
  -X POST "$BASE/items")"
ITEM_ID="$(echo "$ITEM_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")"

curl -sf "${AUTH[@]}" -X POST "$BASE/items/$ITEM_ID/submit-review" >/dev/null
curl -sf "${AUTH[@]}" -X POST "$BASE/items/$ITEM_ID/approve" >/dev/null

PROJ_BODY="/tmp/vd-sop-s1-project.json"
PROJ_CODE="$(
  curl -sS -o "$PROJ_BODY" -w '%{http_code}' "${AUTH[@]}" \
    -H 'Content-Type: application/json' \
    -d "{\"lifecycle_id\":$LIFECYCLE_ID,\"cmkt_item_id\":$ITEM_ID}" \
    -X POST "$API_BASE/api/v1/vd/projects"
)"
if grep -q 'cmkt_cinematic_disabled' "$PROJ_BODY"; then
  echo "SKIP cinematic off"
  exit 0
fi
if grep -q 'video_cinematic_daily_cap' "$PROJ_BODY"; then
  echo "SKIP video_cinematic_daily_cap"
  exit 0
fi
if [[ "$PROJ_CODE" != "201" && "$PROJ_CODE" != "200" ]]; then
  echo "FAIL POST /api/v1/vd/projects HTTP $PROJ_CODE $(cat "$PROJ_BODY")"
  exit 1
fi

PROJ_ID="$(
  python3 -c "
import json, sys
p = json.load(open(sys.argv[1], encoding='utf-8'))
pid = p.get('id')
stage = p.get('stage')
if not isinstance(pid, int) or pid <= 0:
    raise SystemExit(f'FAIL project id not a number got={pid!r}')
if stage != 'brief_draft':
    raise SystemExit(f'FAIL stage={stage!r} expected brief_draft')
print(pid)
" "$PROJ_BODY"
)"

ITEM="$(curl -sf "${AUTH[@]}" "$BASE/items/$ITEM_ID")"
echo "$ITEM" | python3 -c "
import json, sys
item = json.load(sys.stdin)
media = item.get('media_json') or {}
studio = media.get('video_studio')
vd_id = media.get('vd_project_id')
want = int(sys.argv[1])
if studio != 'cinematic':
    raise SystemExit(f'FAIL media_json.video_studio={studio!r} expected cinematic')
if vd_id != want:
    raise SystemExit(f'FAIL media_json.vd_project_id={vd_id!r} expected {want}')
" "$PROJ_ID"

LOCK_BODY="/tmp/vd-sop-s1-lock.json"
LOCK_CODE="$(
  curl -sS -o "$LOCK_BODY" -w '%{http_code}' "${AUTH[@]}" \
    -H 'Content-Type: application/json' \
    -d '{"studio":"social"}' \
    -X POST "$BASE/items/$ITEM_ID/video/lock-studio"
)"
if [[ "$LOCK_CODE" != "400" ]]; then
  echo "FAIL lock-studio expected 400 got $LOCK_CODE $(cat "$LOCK_BODY")"
  exit 1
fi
if ! grep -Eq 'studio_locked|studio_mismatch' "$LOCK_BODY"; then
  echo "FAIL lock-studio body missing studio_locked/studio_mismatch $(cat "$LOCK_BODY")"
  exit 1
fi

STORY_BODY="/tmp/vd-sop-s1-storyboard.json"
STORY_CODE="$(
  curl -sS -o "$STORY_BODY" -w '%{http_code}' "${AUTH[@]}" \
    -H 'Content-Type: application/json' \
    -d '{"pack_default":"reels"}' \
    -X POST "$BASE/items/$ITEM_ID/jobs/video-storyboard"
)"
if [[ "$STORY_CODE" != "400" ]]; then
  echo "FAIL video-storyboard expected 400 got $STORY_CODE $(cat "$STORY_BODY")"
  exit 1
fi
if ! grep -Eq 'studio_locked|studio_mismatch' "$STORY_BODY"; then
  echo "FAIL video-storyboard body missing studio_locked/studio_mismatch $(cat "$STORY_BODY")"
  exit 1
fi

echo "OK Video SOP S1 — project #$PROJ_ID"
