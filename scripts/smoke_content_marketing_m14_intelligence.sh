#!/usr/bin/env bash
# Smoke M14 — weekly memo + apply suggestions + external metrics hooks
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
echo "==> M14 intelligence smoke lifecycle #$LIFECYCLE_ID"

curl -sf "${AUTH[@]}" -H 'Content-Type: application/json' -d '{"range":"30d"}' -X POST "$BASE/jobs/topic-suggest" >/dev/null

MEMO_JOB="$(curl -sf "${AUTH[@]}" -H 'Content-Type: application/json' -d '{"range":"7d"}' -X POST "$BASE/jobs/intelligence/weekly-memo")"
MEMO_STATUS="$(echo "$MEMO_JOB" | python3 -c "import sys,json; print(json.load(sys.stdin).get('status',''))")"
if [[ "$MEMO_STATUS" != "succeeded" ]]; then
  echo "FAIL weekly-memo status=$MEMO_STATUS"
  exit 1
fi

INTEL="$(curl -sf "${AUTH[@]}" "$BASE/intelligence?range=30d")"
HAS_MEMO="$(echo "$INTEL" | python3 -c "import sys,json; print('yes' if json.load(sys.stdin).get('weekly_memo') else 'no')")"
if [[ "$HAS_MEMO" != "yes" ]]; then
  echo "FAIL intelligence missing weekly_memo preview"
  exit 1
fi

EXT_ENABLED="$(echo "$INTEL" | python3 -c "import sys,json; d=json.load(sys.stdin).get('external_metrics') or {}; print('yes' if d.get('enabled') else 'no')")"
if [[ "$EXT_ENABLED" != "yes" ]]; then
  echo "FAIL external_metrics not enabled (set PTT_CMKT_EXTERNAL_METRICS=1)"
  exit 1
fi

APPLY="$(curl -sf "${AUTH[@]}" -H 'Content-Type: application/json' -d '{"suggestion_indices":[0]}' -X POST "$BASE/intelligence/suggestions/apply")"
CREATED="$(echo "$APPLY" | python3 -c "import sys,json; print(json.load(sys.stdin).get('ideas_created',0))")"
if [[ "$CREATED" -lt 1 ]]; then
  echo "FAIL apply suggestions ideas_created=$CREATED"
  exit 1
fi

BULK="$(curl -sf "${AUTH[@]}" -H 'Content-Type: application/json' -d '{"suggestion_indices":[1,2]}' -X POST "$BASE/intelligence/suggestions/bulk-apply")"
BULK_CREATED="$(echo "$BULK" | python3 -c "import sys,json; print(json.load(sys.stdin).get('ideas_created',0))")"
if [[ "$BULK_CREATED" -lt 1 ]]; then
  echo "FAIL bulk-apply ideas_created=$BULK_CREATED"
  exit 1
fi

echo "PASS M14 intelligence smoke — memo + apply + external metrics"
