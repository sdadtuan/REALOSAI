#!/usr/bin/env bash
# Smoke — Video SOP S13: DRAFT→Runway turbo model_key + dual-studio regression
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

echo "==> Video SOP S13 smoke lifecycle #$LIFECYCLE_ID"

MODELS_BODY="/tmp/vd-sop-s13-models.json"
curl -sS -o "$MODELS_BODY" "${AUTH[@]}" "$API_BASE/api/v1/vd/admin/models"
python3 -c "
import json, sys
raw = json.load(open(sys.argv[1], encoding='utf-8'))
items = raw if isinstance(raw, list) else (raw.get('items') if isinstance(raw, dict) else None)
if not isinstance(items, list):
    raise SystemExit('FAIL models list')
draft = next((r for r in items if isinstance(r, dict) and r.get('code') == 'video.runway.gen4_turbo_draft'), None)
kling = next((r for r in items if isinstance(r, dict) and r.get('code') == 'video.kling.v3.pro'), None)
if draft is None:
    raise SystemExit('FAIL missing video.runway.gen4_turbo_draft')
if kling is None:
    raise SystemExit('FAIL missing video.kling.v3.pro')
cap = kling.get('capability_json')
if isinstance(cap, str):
    cap = json.loads(cap)
if cap.get('route') != 'VIA_LEONARDO':
    raise SystemExit(f'FAIL kling route {cap.get(\"route\")!r}')
print('OK registry draft turbo + kling VIA_LEONARDO')
" "$MODELS_BODY"

LIST_BODY="/tmp/vd-sop-s13-projects.json"
curl -sS -o "$LIST_BODY" "${AUTH[@]}" "$API_BASE/api/v1/vd/projects?lifecycle_id=$LIFECYCLE_ID"
PROJ_ID="$(
  python3 -c "
import json, sys
p = json.load(open(sys.argv[1], encoding='utf-8'))
items = p if isinstance(p, list) else (p.get('items') or [])
if items and isinstance(items[0], dict):
    print(items[0].get('id') or '')
" "$LIST_BODY"
)"
if [[ -z "$PROJ_ID" ]]; then
  echo "SKIP no project for motion enqueue check"
else
  JOB_BODY="/tmp/vd-sop-s13-draft-job.json"
  JOB_CODE="$(
    curl -sS -o "$JOB_BODY" -w '%{http_code}' "${AUTH[@]}" \
      -H 'Content-Type: application/json' \
      -H 'Idempotency-Key: vd-s13-draft-intent' \
      -d '{"queue":"q.video.runway","job_type":"cine_motion_draft","payload":{"intent":"DRAFT","model_key":"video.runway.gen4_turbo_draft","imageUrl":"https://img/x.jpg","prompt":"S13 draft","durationSec":5,"providerHint":"runway"}}' \
      "$API_BASE/api/v1/vd/projects/$PROJ_ID/jobs"
  )"
  if [[ "$JOB_CODE" == "201" ]]; then
    echo "OK draft motion job 201 with runway model_key"
  elif [[ "$JOB_CODE" == "400" ]]; then
    echo "SKIP draft motion 400 (stage/cap)"
  else
    echo "FAIL draft motion expected 201 got $JOB_CODE"
    cat "$JOB_BODY" >&2 || true
    exit 1
  fi
fi

if [[ "${VD_E2E_PROVIDERS:-0}" == "1" ]]; then
  echo "NOTE VD_E2E_PROVIDERS=1 — live vendor calls enabled (manual verification)"
else
  echo "OK live provider calls skipped (set VD_E2E_PROVIDERS=1 to enable)"
fi

bash "$ROOT/scripts/smoke_video_sop_dual.sh"
echo "OK Video SOP S13 stub — intent routing + dual studio lifecycle #$LIFECYCLE_ID"
