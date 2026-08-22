#!/usr/bin/env bash
# Smoke — Video SOP S3: brief ready + script + shot feasibility
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
echo "==> Video SOP S3 smoke lifecycle #$LIFECYCLE_ID"

LIST_BODY="/tmp/vd-sop-s3-projects.json"
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
preferred = []
others = []
for it in items:
    if not isinstance(it, dict) or not isinstance(it.get('id'), int) or it['id'] <= 0:
        continue
    if it.get('stage') in ('brief_draft', 'brief_ready'):
        preferred.append(it['id'])
    else:
        others.append(it['id'])
if preferred:
    print(preferred[0])
elif others:
    print(others[0])
" "$LIST_BODY"
  )"
fi

if [[ -z "$PROJ_ID" ]]; then
  ITEM_JSON="$(curl -sf "${AUTH[@]}" -H 'Content-Type: application/json' \
    -d '{"title":"Video SOP S3 smoke","channel":"short_video","format":"video_script","body_json":{"markdown":"Hook 3 giây · beat giá trị · CTA cuối"}}' \
    -X POST "$BASE/items")"
  ITEM_ID="$(echo "$ITEM_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")"

  curl -sf "${AUTH[@]}" -X POST "$BASE/items/$ITEM_ID/submit-review" >/dev/null
  curl -sf "${AUTH[@]}" -X POST "$BASE/items/$ITEM_ID/approve" >/dev/null

  PROJ_BODY="/tmp/vd-sop-s3-project.json"
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
    echo "FAIL POST /api/v1/vd/projects daily cap and no reusable project"
    exit 1
  fi
  if [[ "$PROJ_CODE" != "201" && "$PROJ_CODE" != "200" ]]; then
    echo "FAIL POST /api/v1/vd/projects HTTP $PROJ_CODE"
    exit 1
  fi
  PROJ_ID="$(
    python3 -c "
import json, sys
p = json.load(open(sys.argv[1], encoding='utf-8'))
pid = p.get('id')
if not isinstance(pid, int) or pid <= 0:
    raise SystemExit(f'FAIL project id not a number got={pid!r}')
print(pid)
" "$PROJ_BODY"
  )"
fi

GET_PROJ_BODY="/tmp/vd-sop-s3-project-get.json"
GET_PROJ_CODE="$(
  curl -sS -o "$GET_PROJ_BODY" -w '%{http_code}' "${AUTH[@]}" \
    "$API_BASE/api/v1/vd/projects/$PROJ_ID"
)"
if [[ "$GET_PROJ_CODE" != "200" ]]; then
  echo "FAIL GET /projects/$PROJ_ID HTTP $GET_PROJ_CODE"
  exit 1
fi
STAGE="$(
  python3 -c "
import json, sys
p = json.load(open(sys.argv[1], encoding='utf-8'))
stage = p.get('stage')
if not isinstance(stage, str) or not stage:
    raise SystemExit(f'FAIL stage missing got={stage!r}')
print(stage)
" "$GET_PROJ_BODY"
)"

INCOMPLETE_BODY='{"objective":"hi","audience":"khách hàng phổ thông A","offer":"gói retainer content","duration_sec":30,"platform":"reels","tone":"rõ ràng","constraints":"không mặt người","insight_ids":[]}'
COMPLETE_BODY='{"objective":"tăng nhận biết","audience":"khách hàng phổ thông A","offer":"gói retainer content","duration_sec":30,"platform":"reels","tone":"rõ ràng","constraints":"không mặt người","insight_ids":[]}'

# Reuse is not idempotent if we POST /brief/ready after brief_ready (stage_guard).
# brief_draft: full flow. brief_ready: skip ready. scripting+: skip ready + reuse script.
if [[ "$STAGE" == "brief_draft" ]]; then
  PUT_INC_BODY="/tmp/vd-sop-s3-brief-incomplete.json"
  PUT_INC_CODE="$(
    curl -sS -o "$PUT_INC_BODY" -w '%{http_code}' "${AUTH[@]}" \
      -H 'Content-Type: application/json' \
      -d "$INCOMPLETE_BODY" \
      -X PUT "$API_BASE/api/v1/vd/projects/$PROJ_ID/brief"
  )"
  if [[ "$PUT_INC_CODE" != "200" && "$PUT_INC_CODE" != "201" ]]; then
    echo "FAIL PUT /brief incomplete HTTP $PUT_INC_CODE"
    exit 1
  fi

  READY_INC_BODY="/tmp/vd-sop-s3-brief-ready-inc.json"
  READY_INC_CODE="$(
    curl -sS -o "$READY_INC_BODY" -w '%{http_code}' "${AUTH[@]}" \
      -X POST "$API_BASE/api/v1/vd/projects/$PROJ_ID/brief/ready"
  )"
  if [[ "$READY_INC_CODE" != "400" ]]; then
    echo "FAIL POST /brief/ready incomplete expected 400 got $READY_INC_CODE"
    exit 1
  fi
  if ! grep -q 'brief_incomplete' "$READY_INC_BODY"; then
    echo "FAIL POST /brief/ready incomplete missing brief_incomplete"
    exit 1
  fi

  PUT_OK_BODY="/tmp/vd-sop-s3-brief-complete.json"
  PUT_OK_CODE="$(
    curl -sS -o "$PUT_OK_BODY" -w '%{http_code}' "${AUTH[@]}" \
      -H 'Content-Type: application/json' \
      -d "$COMPLETE_BODY" \
      -X PUT "$API_BASE/api/v1/vd/projects/$PROJ_ID/brief"
  )"
  if [[ "$PUT_OK_CODE" != "200" && "$PUT_OK_CODE" != "201" ]]; then
    echo "FAIL PUT /brief complete HTTP $PUT_OK_CODE"
    exit 1
  fi

  READY_OK_BODY="/tmp/vd-sop-s3-brief-ready.json"
  READY_OK_CODE="$(
    curl -sS -o "$READY_OK_BODY" -w '%{http_code}' "${AUTH[@]}" \
      -X POST "$API_BASE/api/v1/vd/projects/$PROJ_ID/brief/ready"
  )"
  if [[ "$READY_OK_CODE" != "200" ]]; then
    echo "FAIL POST /brief/ready complete HTTP $READY_OK_CODE"
    exit 1
  fi
  python3 -c "
import json, sys
p = json.load(open(sys.argv[1], encoding='utf-8'))
stage = p.get('stage')
if stage != 'brief_ready':
    raise SystemExit(f'FAIL stage={stage!r} expected brief_ready')
" "$READY_OK_BODY"
  STAGE=brief_ready
fi

SCRIPT_LIST_BODY="/tmp/vd-sop-s3-scripts.json"
SCRIPT_LIST_CODE="$(
  curl -sS -o "$SCRIPT_LIST_BODY" -w '%{http_code}' "${AUTH[@]}" \
    "$API_BASE/api/v1/vd/projects/$PROJ_ID/scripts"
)"
if [[ "$SCRIPT_LIST_CODE" != "200" ]]; then
  echo "FAIL GET /projects/$PROJ_ID/scripts HTTP $SCRIPT_LIST_CODE"
  exit 1
fi
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

CREATED_SCRIPT=0
if [[ -z "$SCRIPT_ID" ]]; then
  if [[ "$STAGE" != "brief_ready" && "$STAGE" != "ideation" && "$STAGE" != "scripting" ]]; then
    echo "FAIL GET /projects/$PROJ_ID/scripts empty at stage=$STAGE"
    exit 1
  fi
  SCRIPT_BODY="/tmp/vd-sop-s3-script.json"
  SCRIPT_CODE="$(
    curl -sS -o "$SCRIPT_BODY" -w '%{http_code}' "${AUTH[@]}" \
      -H 'Content-Type: application/json' \
      -d '{"markdown":"S3 smoke"}' \
      -X POST "$API_BASE/api/v1/vd/projects/$PROJ_ID/scripts"
  )"
  if [[ "$SCRIPT_CODE" != "201" && "$SCRIPT_CODE" != "200" ]]; then
    echo "FAIL POST /scripts HTTP $SCRIPT_CODE"
    exit 1
  fi
  SCRIPT_ID="$(
    python3 -c "
import json, sys
p = json.load(open(sys.argv[1], encoding='utf-8'))
sid = p.get('id')
if not isinstance(sid, int) or sid <= 0:
    raise SystemExit(f'FAIL script id not a number got={sid!r}')
print(sid)
" "$SCRIPT_BODY"
  )"
  CREATED_SCRIPT=1
fi

GET_PROJ_CODE="$(
  curl -sS -o "$GET_PROJ_BODY" -w '%{http_code}' "${AUTH[@]}" \
    "$API_BASE/api/v1/vd/projects/$PROJ_ID"
)"
if [[ "$GET_PROJ_CODE" != "200" ]]; then
  echo "FAIL GET /projects/$PROJ_ID HTTP $GET_PROJ_CODE"
  exit 1
fi
if [[ "$CREATED_SCRIPT" == "1" ]]; then
  python3 -c "
import json, sys
p = json.load(open(sys.argv[1], encoding='utf-8'))
stage = p.get('stage')
if stage != 'scripting':
    raise SystemExit(f'FAIL stage={stage!r} expected scripting')
" "$GET_PROJ_BODY"
fi

BLOCKED_SHOT='{"duration_ms":20000,"camera":"push in","action":"walk","aspect":"9:16","contains_human":false}'
SHOT_BAD_BODY="/tmp/vd-sop-s3-shot-blocked.json"
SHOT_BAD_CODE="$(
  curl -sS -o "$SHOT_BAD_BODY" -w '%{http_code}' "${AUTH[@]}" \
    -H 'Content-Type: application/json' \
    -d "$BLOCKED_SHOT" \
    -X POST "$API_BASE/api/v1/vd/scripts/$SCRIPT_ID/shots"
)"
if [[ "$SHOT_BAD_CODE" != "400" ]]; then
  echo "FAIL POST /shots duration_ms=20000 expected 400 got $SHOT_BAD_CODE"
  exit 1
fi
if ! grep -q 'feasibility_blocked' "$SHOT_BAD_BODY"; then
  echo "FAIL POST /shots duration_ms=20000 missing feasibility_blocked"
  exit 1
fi

VALID_SHOT='{"duration_ms":3000,"camera":"push in","action":"walk","aspect":"9:16","contains_human":false}'
SHOT_OK_BODY="/tmp/vd-sop-s3-shot-ok.json"
SHOT_OK_CODE="$(
  curl -sS -o "$SHOT_OK_BODY" -w '%{http_code}' "${AUTH[@]}" \
    -H 'Content-Type: application/json' \
    -d "$VALID_SHOT" \
    -X POST "$API_BASE/api/v1/vd/scripts/$SCRIPT_ID/shots"
)"
if [[ "$SHOT_OK_CODE" != "201" && "$SHOT_OK_CODE" != "200" ]]; then
  echo "FAIL POST /shots valid HTTP $SHOT_OK_CODE"
  exit 1
fi
python3 -c "
import json, sys
p = json.load(open(sys.argv[1], encoding='utf-8'))
status = p.get('status')
if status != 'draft':
    raise SystemExit(f'FAIL shot status={status!r} expected draft')
" "$SHOT_OK_BODY"

echo "OK Video SOP S3 — project #$PROJ_ID"
