#!/usr/bin/env bash
# WS-P4-03 — async multi-agent pipeline (MKTP-UC-022)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ -f "$ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env"
  set +a
fi

API_URL="${PTT_API_URL:-http://127.0.0.1:3000}"
LIFECYCLE_ID="${LIFECYCLE_ID:-1}"
KEY="${PTT_CRM_INTERNAL_KEY:-}"
EMAIL="${ADMIN_EMAIL:-${OPS_E2E_STAFF_EMAIL:-admin@pttads.vn}}"
PASS="${ADMIN_PASSWORD:-${OPS_E2E_STAFF_PASSWORD:-}}"
MAX_WAIT_SEC="${MAX_WAIT_SEC:-120}"
POLL_SEC="${POLL_SEC:-2}"

AUTH=()
if [[ -n "$KEY" ]]; then
  AUTH=(-H "x-ptt-internal-key: $KEY")
elif [[ -n "$PASS" ]]; then
  TOKEN="$(
    curl -sf "$API_URL/api/v1/staff/auth/login" \
      -H 'Content-Type: application/json' \
      -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}" \
    | python3 -c "import sys,json; print(json.load(sys.stdin).get('access_token',''))" 2>/dev/null || true
  )"
  [[ -n "$TOKEN" ]] && AUTH=(-H "Authorization: Bearer $TOKEN")
fi

if [[ ${#AUTH[@]} -eq 0 ]]; then
  echo "FAIL: set PTT_CRM_INTERNAL_KEY or ADMIN_PASSWORD for smoke auth"
  exit 1
fi

auth=("${AUTH[@]}" -H "Content-Type: application/json")
base="$API_URL/api/crm/service-lifecycle/$LIFECYCLE_ID/ai-planner"

echo "== smoke_mkt_ai_multi_agent_async WS-P4-03 =="
echo "lifecycle=$LIFECYCLE_ID api=$API_URL max_wait=${MAX_WAIT_SEC}s"

ctx="$(curl -sf "${auth[@]}" "$base/context")"
echo "$ctx" | grep -q '"enabled":true' || { echo "FAIL: planner disabled"; exit 1; }
echo "$ctx" | grep -q '"multi_agent_enabled":true' || {
  echo "WARN: multi_agent_enabled false — set PTT_MKT_AI_MULTI_AGENT_ENABLED=1"
}

# Ensure brief is minimally valid for pipeline
curl -sf "${auth[@]}" -X PATCH "$base/brief" -d '{
  "brand_name": "Smoke Async Brand",
  "industry": "Logistics",
  "objective": "lead",
  "budget_monthly_vnd": 50000000,
  "geo_markets": ["HCM"],
  "challenges": "Smoke async pipeline test"
}' >/dev/null || echo "WARN: brief patch skipped"

post_headers="$(mktemp)"
post_body="$(mktemp)"
http_code="$(
  curl -sS -o "$post_body" -D "$post_headers" -w '%{http_code}' \
    "${auth[@]}" -X POST "$base/jobs/multi-agent" \
    -d '{"async":true,"skip_analyst":true}'
)"

echo "POST multi-agent HTTP $http_code"
if [[ "$http_code" != "202" && "$http_code" != "200" ]]; then
  echo "FAIL: unexpected HTTP $http_code"
  cat "$post_body"
  rm -f "$post_headers" "$post_body"
  exit 1
fi

if [[ "$http_code" == "202" ]]; then
  echo "OK async accepted (202)"
else
  echo "WARN: sync fallback (200) — PTT_MKT_AI_MULTI_AGENT_ASYNC may be off"
fi

grep -q '"job_id"' "$post_body" || { echo "FAIL: missing job_id"; cat "$post_body"; exit 1; }
job_id="$(python3 -c "import json; print(json.load(open('$post_body')).get('job_id',''))")"
echo "job_id=$job_id"

deadline=$((SECONDS + MAX_WAIT_SEC))
final_status=""
while [[ $SECONDS -lt $deadline ]]; do
  status_out="$(curl -sf "${auth[@]}" "$base/multi-agent/status")"
  rollup="$(python3 -c "import json,sys; print(json.loads(sys.argv[1]).get('rollup_status',''))" "$status_out")"
  progress="$(python3 -c "import json,sys; d=json.loads(sys.argv[1]); print(d.get('progress_pct',''))" "$status_out")"
  echo "poll rollup=$rollup progress=${progress}%"
  case "$rollup" in
    succeeded|partial|failed)
      final_status="$rollup"
      break
      ;;
  esac
  sleep "$POLL_SEC"
done

rm -f "$post_headers" "$post_body"

if [[ -z "$final_status" ]]; then
  echo "FAIL: pipeline did not finish within ${MAX_WAIT_SEC}s"
  exit 1
fi

if [[ "$final_status" == "failed" ]]; then
  echo "FAIL: pipeline rollup failed"
  exit 1
fi

echo "OK pipeline finished: $final_status"

# 409 when re-post while running (best-effort — may already be done)
running_code="$(
  curl -sS -o /dev/null -w '%{http_code}' \
    "${auth[@]}" -X POST "$base/jobs/multi-agent" \
    -d '{"async":true}' 2>/dev/null || echo "000"
)"
if [[ "$running_code" == "409" ]]; then
  echo "OK 409 conflict on duplicate run"
elif [[ "$final_status" != "running" ]]; then
  echo "SKIP 409 check (pipeline already terminal)"
else
  echo "WARN: expected 409 got HTTP $running_code"
fi

echo "PASS smoke_mkt_ai_multi_agent_async"
