#!/usr/bin/env bash
# Smoke — Video SOP S6: motion takes BR-07/BR-08 + gate 3 stub
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

# Stub key so motion jobs succeed without real Kling/Runway
export PTT_VD_KLING_API_KEY="${PTT_VD_KLING_API_KEY:-smoke-s6-stub-key}"

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

echo "==> Video SOP S6 smoke lifecycle #$LIFECYCLE_ID"

LIST_BODY="/tmp/vd-sop-s6-projects.json"
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
  echo "FAIL no reusable project — run smoke_video_sop_s5.sh first"
  exit 1
fi

SHOTS_BODY="/tmp/vd-sop-s6-shots.json"
curl -sS -o "$SHOTS_BODY" "${AUTH[@]}" \
  "$API_BASE/api/v1/vd/projects/$PROJ_ID/shots" >/dev/null
SHOT_ID="$(
  python3 -c "
import json, sys
p = json.load(open(sys.argv[1], encoding='utf-8'))
items = p if isinstance(p, list) else (p.get('items') or [])
for it in items:
    if isinstance(it, dict) and isinstance(it.get('id'), int) and it['id'] > 0:
        print(it['id'])
        break
" "$SHOTS_BODY"
)"

if [[ -z "$SHOT_ID" ]]; then
  echo "FAIL no shot for project #$PROJ_ID"
  exit 1
fi

# BR-07: final without passed draft → 400 take_draft_required
FINAL_FAIL_BODY="/tmp/vd-sop-s6-final-fail.json"
FINAL_FAIL_CODE="$(
  curl -sS -o "$FINAL_FAIL_BODY" -w '%{http_code}' "${AUTH[@]}" \
    -H 'Content-Type: application/json' \
    -H 'Idempotency-Key: smoke-s6-final-no-draft' \
    -d '{"job_type":"cine_motion_final"}' \
    -X POST "$API_BASE/api/v1/vd/shots/$SHOT_ID/jobs"
)"
if [[ "$FINAL_FAIL_CODE" != "400" ]]; then
  echo "FAIL cine_motion_final without passed draft expected 400 got $FINAL_FAIL_CODE"
  cat "$FINAL_FAIL_BODY" >&2 || true
  exit 1
fi
python3 -c "
import json, sys
p = json.load(open(sys.argv[1], encoding='utf-8'))
err = p.get('error') or p.get('message') or ''
if err != 'take_draft_required':
    raise SystemExit(f'FAIL expected take_draft_required got={err!r}')
" "$FINAL_FAIL_BODY"

# Motion draft enqueue → 201
DRAFT_BODY="/tmp/vd-sop-s6-draft.json"
DRAFT_CODE="$(
  curl -sS -o "$DRAFT_BODY" -w '%{http_code}' "${AUTH[@]}" \
    -H 'Content-Type: application/json' \
    -H 'Idempotency-Key: smoke-s6-draft-'"$SHOT_ID" \
    -d '{"job_type":"cine_motion_draft","prompt":"smoke walk"}' \
    -X POST "$API_BASE/api/v1/vd/shots/$SHOT_ID/jobs"
)"
if [[ "$DRAFT_CODE" != "201" ]]; then
  echo "FAIL cine_motion_draft enqueue expected 201 got $DRAFT_CODE"
  cat "$DRAFT_BODY" >&2 || true
  exit 1
fi

sleep 1

TAKES_BODY="/tmp/vd-sop-s6-takes.json"
curl -sS -o "$TAKES_BODY" "${AUTH[@]}" \
  "$API_BASE/api/v1/vd/projects/$PROJ_ID/takes" >/dev/null
ASSET_ID="$(
  python3 -c "
import json, sys
p = json.load(open(sys.argv[1], encoding='utf-8'))
items = p if isinstance(p, list) else (p.get('items') or [])
for it in items:
    if isinstance(it, dict) and isinstance(it.get('asset_id'), int) and it['asset_id'] > 0:
        print(it['asset_id'])
        break
" "$TAKES_BODY"
)"

if [[ -n "$ASSET_ID" ]]; then
  for i in 1 2 3 4 5; do
    curl -sS -o /dev/null "${AUTH[@]}" \
      -H 'Content-Type: application/json' \
      -d "{\"asset_id\":$ASSET_ID,\"verdict\":\"failed\",\"artifact_json\":{\"smoke_fail\":$i}}" \
      -X POST "$API_BASE/api/v1/vd/shots/$SHOT_ID/take-score" || true
  done

  SHOTS_AFTER="/tmp/vd-sop-s6-shots-after.json"
  curl -sS -o "$SHOTS_AFTER" "${AUTH[@]}" \
    "$API_BASE/api/v1/vd/projects/$PROJ_ID/shots" >/dev/null
  python3 -c "
import json, sys
p = json.load(open(sys.argv[1], encoding='utf-8'))
items = p if isinstance(p, list) else (p.get('items') or [])
shot = next((it for it in items if it.get('id') == int(sys.argv[2])), None)
if not shot:
    raise SystemExit('FAIL shot not found after 5 fails')
if shot.get('status') != 'blocked':
    raise SystemExit(f'FAIL BR-08 expected blocked got={shot.get(\"status\")!r}')
" "$SHOTS_AFTER" "$SHOT_ID"
fi

G3_BODY="/tmp/vd-sop-s6-g3.json"
G3_CODE="$(
  curl -sS -o "$G3_BODY" -w '%{http_code}' "${AUTH[@]}" \
    "$API_BASE/api/v1/vd/projects/$PROJ_ID/gates/3"
)"
if [[ "$G3_CODE" != "200" ]]; then
  echo "FAIL GET /gates/3 HTTP $G3_CODE"
  cat "$G3_BODY" >&2 || true
  exit 1
fi

G3_APPROVE_BODY="/tmp/vd-sop-s6-g3-approve.json"
G3_APPROVE_CODE="$(
  curl -sS -o "$G3_APPROVE_BODY" -w '%{http_code}' "${AUTH[@]}" \
    -H 'Content-Type: application/json' \
    -d '{}' \
    -X POST "$API_BASE/api/v1/vd/projects/$PROJ_ID/gates/3/approve"
)"
if [[ "$G3_APPROVE_CODE" != "400" ]]; then
  echo "FAIL gate3 approve without clip_selected expected 400 got $G3_APPROVE_CODE"
  cat "$G3_APPROVE_BODY" >&2 || true
  exit 1
fi
python3 -c "
import json, sys
p = json.load(open(sys.argv[1], encoding='utf-8'))
err = p.get('error') or p.get('message') or ''
if err != 'gate3_incomplete':
    raise SystemExit(f'FAIL expected gate3_incomplete got={err!r}')
" "$G3_APPROVE_BODY"

echo "OK Video SOP S6 — project #$PROJ_ID shot #$SHOT_ID"
