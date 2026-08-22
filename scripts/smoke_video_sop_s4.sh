#!/usr/bin/env bash
# Smoke — Video SOP S4: bible + shot keyframe job
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

echo "==> Video SOP S4 smoke lifecycle #$LIFECYCLE_ID"

LIST_BODY="/tmp/vd-sop-s4-projects.json"
LIST_CODE="$(
  curl -sS -o "$LIST_BODY" -w '%{http_code}' "${AUTH[@]}" \
    "$API_BASE/api/v1/vd/projects?lifecycle_id=$LIFECYCLE_ID"
)"
if grep -q 'cmkt_cinematic_disabled' "$LIST_BODY"; then
  echo "SKIP cinematic off"
  exit 0
fi

PROJ_ID=""
if [[ "$LIST_CODE" == "200" ]]; then
  PROJ_ID="$(
    python3 -c "
import json, sys
p = json.load(open(sys.argv[1], encoding='utf-8'))
items = p if isinstance(p, list) else (p.get('items') or [])
ids = [it['id'] for it in items if isinstance(it, dict) and isinstance(it.get('id'), int) and it['id'] > 0]
if ids:
    print(ids[0])
" "$LIST_BODY"
  )"
fi

if [[ -z "$PROJ_ID" ]]; then
  echo "FAIL no reusable project — run smoke_video_sop_s3.sh first"
  exit 1
fi

STYLE_BODY='{"palette":["#000"],"lens":"50mm","lighting":"soft","refs":[]}'
STYLE_CODE="$(
  curl -sS -o /tmp/vd-sop-s4-style.json -w '%{http_code}' "${AUTH[@]}" \
    -H 'Content-Type: application/json' \
    -d "$STYLE_BODY" \
    -X PUT "$API_BASE/api/v1/vd/projects/$PROJ_ID/bibles/style"
)"
if [[ "$STYLE_CODE" != "200" && "$STYLE_CODE" != "201" ]]; then
  echo "FAIL PUT /bibles/style HTTP $STYLE_CODE"
  exit 1
fi

CHARS_BODY='{"items":[{"name":"Hero","lock_regions":["face"],"notes":""}]}'
CHARS_CODE="$(
  curl -sS -o /tmp/vd-sop-s4-chars.json -w '%{http_code}' "${AUTH[@]}" \
    -H 'Content-Type: application/json' \
    -d "$CHARS_BODY" \
    -X PUT "$API_BASE/api/v1/vd/projects/$PROJ_ID/bibles/characters"
)"
if [[ "$CHARS_CODE" != "200" && "$CHARS_CODE" != "201" ]]; then
  echo "FAIL PUT /bibles/characters HTTP $CHARS_CODE"
  exit 1
fi

SHOTS_BODY="/tmp/vd-sop-s4-shots.json"
SHOTS_CODE="$(
  curl -sS -o "$SHOTS_BODY" -w '%{http_code}' "${AUTH[@]}" \
    "$API_BASE/api/v1/vd/projects/$PROJ_ID/shots"
)"
if [[ "$SHOTS_CODE" != "200" ]]; then
  echo "FAIL GET /projects/$PROJ_ID/shots HTTP $SHOTS_CODE"
  exit 1
fi

SHOT_ID="$(
  python3 -c "
import json, sys
p = json.load(open(sys.argv[1], encoding='utf-8'))
items = p if isinstance(p, list) else (p.get('items') or [])
ids = [it['id'] for it in items if isinstance(it, dict) and isinstance(it.get('id'), int) and it['id'] > 0]
if ids:
    print(ids[0])
" "$SHOTS_BODY"
)"

if [[ -z "$SHOT_ID" ]]; then
  SCRIPT_LIST_BODY="/tmp/vd-sop-s4-scripts.json"
  curl -sS -o "$SCRIPT_LIST_BODY" "${AUTH[@]}" "$API_BASE/api/v1/vd/projects/$PROJ_ID/scripts" >/dev/null
  SCRIPT_ID="$(
    python3 -c "
import json, sys
p = json.load(open(sys.argv[1], encoding='utf-8'))
items = p if isinstance(p, list) else (p.get('items') or [])
ids = [it['id'] for it in items if isinstance(it, dict) and isinstance(it.get('id'), int) and it['id'] > 0]
if ids:
    print(max(ids))
" "$SCRIPT_LIST_BODY"
  )"
  if [[ -z "$SCRIPT_ID" ]]; then
    echo "FAIL no script for project — run smoke_video_sop_s3.sh first"
    exit 1
  fi
  VALID_SHOT='{"duration_ms":3000,"camera":"push in","action":"walk {{lock:face}}","aspect":"9:16","contains_human":false}'
  SHOT_OK_BODY="/tmp/vd-sop-s4-shot-ok.json"
  SHOT_OK_CODE="$(
    curl -sS -o "$SHOT_OK_BODY" -w '%{http_code}' "${AUTH[@]}" \
      -H 'Content-Type: application/json' \
      -d "$VALID_SHOT" \
      -X POST "$API_BASE/api/v1/vd/scripts/$SCRIPT_ID/shots"
  )"
  if [[ "$SHOT_OK_CODE" != "201" && "$SHOT_OK_CODE" != "200" ]]; then
    echo "FAIL POST /shots HTTP $SHOT_OK_CODE"
    exit 1
  fi
  SHOT_ID="$(
    python3 -c "
import json, sys
p = json.load(open(sys.argv[1], encoding='utf-8'))
sid = p.get('id')
if not isinstance(sid, int) or sid <= 0:
    raise SystemExit(f'FAIL shot id got={sid!r}')
print(sid)
" "$SHOT_OK_BODY"
  )"
fi

JOB_BODY="/tmp/vd-sop-s4-job-enqueue.json"
JOB_CODE="$(
  curl -sS -o "$JOB_BODY" -w '%{http_code}' "${AUTH[@]}" \
    -H 'Content-Type: application/json' \
    -H 'Idempotency-Key: smoke-s4-1' \
    -d '{}' \
    -X POST "$API_BASE/api/v1/vd/shots/$SHOT_ID/jobs"
)"
if [[ "$JOB_CODE" != "201" ]]; then
  echo "FAIL POST /shots/$SHOT_ID/jobs HTTP $JOB_CODE"
  exit 1
fi

JOB_ID="$(
  python3 -c "
import json, sys
p = json.load(open(sys.argv[1], encoding='utf-8'))
jid = p.get('id')
if not isinstance(jid, int) or jid <= 0:
    raise SystemExit(f'FAIL job id got={jid!r}')
print(jid)
" "$JOB_BODY"
)"

TERMINAL=""
for _ in $(seq 1 8); do
  sleep 1
  GET_JOB_BODY="/tmp/vd-sop-s4-job-get.json"
  curl -sS -o "$GET_JOB_BODY" "${AUTH[@]}" "$API_BASE/api/v1/vd/jobs/$JOB_ID" >/dev/null
  TERMINAL="$(
    python3 -c "
import json, sys
p = json.load(open(sys.argv[1], encoding='utf-8'))
status = p.get('status')
print(status if status in ('succeeded','failed','cancelled','stale') else '')
" "$GET_JOB_BODY"
  )"
  if [[ -n "$TERMINAL" ]]; then
    break
  fi
done

if [[ -z "$TERMINAL" ]]; then
  echo "FAIL job $JOB_ID did not reach terminal within 8s"
  exit 1
fi

GET_SHOT_BODY="/tmp/vd-sop-s4-shot-status.json"
# Re-fetch shots list for status check
curl -sS -o "$SHOTS_BODY" "${AUTH[@]}" "$API_BASE/api/v1/vd/projects/$PROJ_ID/shots" >/dev/null
python3 -c "
import json, sys
items = json.load(open(sys.argv[1], encoding='utf-8'))
if not isinstance(items, list):
    items = items.get('items') or []
shot = next((it for it in items if isinstance(it, dict) and it.get('id') == int(sys.argv[2])), None)
if not shot:
    raise SystemExit('FAIL shot not found after job')
status = shot.get('status')
if status == 'keyframe_approved':
    raise SystemExit(f'FAIL shot status={status!r} must not be keyframe_approved in S4')
" "$SHOTS_BODY" "$SHOT_ID"

if [[ "$TERMINAL" == "succeeded" ]]; then
  KF_BODY="/tmp/vd-sop-s4-keyframes.json"
  KF_CODE="$(
    curl -sS -o "$KF_BODY" -w '%{http_code}' "${AUTH[@]}" \
      "$API_BASE/api/v1/vd/projects/$PROJ_ID/keyframes"
  )"
  if [[ "$KF_CODE" != "200" ]]; then
    echo "FAIL GET /keyframes HTTP $KF_CODE"
    exit 1
  fi
  python3 -c "
import json, sys
p = json.load(open(sys.argv[1], encoding='utf-8'))
items = p if isinstance(p, list) else (p.get('items') or [])
if len(items) < 1:
    raise SystemExit('FAIL expected keyframe assets >= 1 on success')
" "$KF_BODY"
fi

echo "OK Video SOP S4 — project #$PROJ_ID"
