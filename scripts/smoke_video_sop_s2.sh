#!/usr/bin/env bash
# Smoke — Video SOP S2: idempotent cine_keyframe job + providers without secrets
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
echo "==> Video SOP S2 smoke lifecycle #$LIFECYCLE_ID"

LIST_BODY="/tmp/vd-sop-s2-projects.json"
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
if items and isinstance(items[0], dict) and isinstance(items[0].get('id'), int) and items[0]['id'] > 0:
    print(items[0]['id'])
" "$LIST_BODY"
  )"
fi

if [[ -z "$PROJ_ID" ]]; then
  ITEM_JSON="$(curl -sf "${AUTH[@]}" -H 'Content-Type: application/json' \
    -d '{"title":"Video SOP S2 smoke","channel":"short_video","format":"video_script","body_json":{"markdown":"Hook 3 giây · beat giá trị · CTA cuối"}}' \
    -X POST "$BASE/items")"
  ITEM_ID="$(echo "$ITEM_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")"

  curl -sf "${AUTH[@]}" -X POST "$BASE/items/$ITEM_ID/submit-review" >/dev/null
  curl -sf "${AUTH[@]}" -X POST "$BASE/items/$ITEM_ID/approve" >/dev/null

  PROJ_BODY="/tmp/vd-sop-s2-project.json"
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
    echo "FAIL POST /api/v1/vd/projects daily cap and no reusable project $(cat "$PROJ_BODY")"
    exit 1
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
if not isinstance(pid, int) or pid <= 0:
    raise SystemExit(f'FAIL project id not a number got={pid!r}')
print(pid)
" "$PROJ_BODY"
  )"
fi

JOB_PAYLOAD='{"queue":"q.image","job_type":"cine_keyframe","payload":{"prompt":"S2 smoke keyframe","width":1024,"height":1024}}'
JOB1_BODY="/tmp/vd-sop-s2-job1.json"
JOB2_BODY="/tmp/vd-sop-s2-job2.json"

JOB1_CODE="$(
  curl -sS -o "$JOB1_BODY" -w '%{http_code}' "${AUTH[@]}" \
    -H 'Content-Type: application/json' \
    -H 'Idempotency-Key: smoke-s2-1' \
    -d "$JOB_PAYLOAD" \
    -X POST "$API_BASE/api/v1/vd/projects/$PROJ_ID/jobs"
)"
if grep -q 'cmkt_cinematic_disabled' "$JOB1_BODY"; then
  echo "SKIP cinematic off"
  exit 0
fi
if [[ "$JOB1_CODE" != "201" && "$JOB1_CODE" != "200" ]]; then
  echo "FAIL POST jobs #1 HTTP $JOB1_CODE $(cat "$JOB1_BODY")"
  exit 1
fi

JOB2_CODE="$(
  curl -sS -o "$JOB2_BODY" -w '%{http_code}' "${AUTH[@]}" \
    -H 'Content-Type: application/json' \
    -H 'Idempotency-Key: smoke-s2-1' \
    -d "$JOB_PAYLOAD" \
    -X POST "$API_BASE/api/v1/vd/projects/$PROJ_ID/jobs"
)"
if [[ "$JOB2_CODE" != "201" && "$JOB2_CODE" != "200" ]]; then
  echo "FAIL POST jobs #2 HTTP $JOB2_CODE $(cat "$JOB2_BODY")"
  exit 1
fi

JOB="$(
  python3 -c "
import json, sys
a = json.load(open(sys.argv[1], encoding='utf-8'))
b = json.load(open(sys.argv[2], encoding='utf-8'))
id1, id2 = a.get('id'), b.get('id')
if not isinstance(id1, int) or id1 <= 0:
    raise SystemExit(f'FAIL job id not a number got={id1!r}')
if id1 != id2:
    raise SystemExit(f'FAIL idempotent POST ids differ {id1!r} vs {id2!r}')
print(id1)
" "$JOB1_BODY" "$JOB2_BODY"
)"

GET_BODY="/tmp/vd-sop-s2-job-get.json"
GET_META="$(
  curl -sS -o "$GET_BODY" -w '%{http_code} %{time_total}' "${AUTH[@]}" \
    "$API_BASE/api/v1/vd/jobs/$JOB"
)"
GET_CODE="${GET_META%% *}"
GET_TIME="${GET_META##* }"
if [[ "$GET_CODE" != "200" ]]; then
  echo "FAIL GET job HTTP $GET_CODE $(cat "$GET_BODY")"
  exit 1
fi

python3 -c "
import json, sys
elapsed = float(sys.argv[2])
if elapsed >= 2:
    raise SystemExit(f'FAIL GET job took {elapsed:.3f}s (>=2s)')
p = json.load(open(sys.argv[1], encoding='utf-8'))
status = p.get('status')
error_class = p.get('error_class')
ok = ('queued', 'running', 'succeeded')
if status in ok:
    pass
elif status == 'failed':
    if error_class != 'auth':
        raise SystemExit(f'FAIL job status=failed error_class={error_class!r} expected auth')
else:
    raise SystemExit(f'FAIL job status={status!r} expected queued|running|succeeded|failed(auth)')
print(f'GET job #{p.get(\"id\")} status={status} error_class={error_class!r} {elapsed:.3f}s')
" "$GET_BODY" "$GET_TIME"

PROV_AUTH=("${AUTH[@]}")
if [[ -n "$INTERNAL_KEY" ]]; then
  PROV_AUTH=(-H "x-ptt-internal-key: $INTERNAL_KEY")
fi
PROV_BODY="/tmp/vd-sop-s2-providers.json"
PROV_CODE="$(
  curl -sS -o "$PROV_BODY" -w '%{http_code}' "${PROV_AUTH[@]}" \
    "$API_BASE/api/v1/vd/admin/providers"
)"
if [[ "$PROV_CODE" != "200" ]]; then
  echo "FAIL GET /api/v1/vd/admin/providers HTTP $PROV_CODE"
  exit 1
fi
if grep -q '"api_key"' "$PROV_BODY"; then
  echo "FAIL admin providers leaked api_key"
  exit 1
fi

echo "OK Video SOP S2 — job #$JOB"
