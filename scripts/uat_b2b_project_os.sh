#!/usr/bin/env bash
# W0 UAT — B2B Lead Project OS (B2B-01…18).
# Automated gate: B2B-01 + B2B-02 + optional B2B-04.
# Cases missing env SKIP with a reason; do not fail silently.
set -euo pipefail

API="${API_URL:-}"
STAFF_TOKEN="${STAFF_TOKEN:-}"
OUTSIDER_TOKEN="${OUTSIDER_TOKEN:-}"
DENIED_LEAD_ID="${DENIED_LEAD_ID:-}"
OWNED_LEAD_ID="${OWNED_LEAD_ID:-}"

pass=0
fail=0
skip=0

skip_case() {
  echo "SKIP $1 — $2"
  skip=$((skip + 1))
}

pass_case() {
  echo "PASS $1"
  pass=$((pass + 1))
}

fail_case() {
  echo "FAIL $1 — $2"
  fail=$((fail + 1))
}

# HTTP code + error field only — never dump the JSON body (may contain PII).
json_error() {
  local f="${1:-}"
  [[ -f "$f" ]] || { echo ""; return; }
  sed -n 's/.*"error"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$f" | head -1
}

# B2B-01: POST B2B lead missing project → 400 b2b_project_required
if [[ -z "$API" || -z "$STAFF_TOKEN" ]]; then
  skip_case "B2B-01" "missing API_URL and/or STAFF_TOKEN"
else
  code=$(curl -s -o /tmp/b2b400.json -w '%{http_code}' -X POST "$API/api/v1/leads" \
    -H "Authorization: Bearer $STAFF_TOKEN" -H 'Content-Type: application/json' \
    -d '{"full_name":"X","phone":"0900000000","lead_flow_kind":"b2b_prospect"}')
  if [[ "$code" == "400" ]] && grep -q b2b_project_required /tmp/b2b400.json; then
    pass_case "B2B-01"
  else
    fail_case "B2B-01" "expected 400 b2b_project_required, got HTTP $code error=$(json_error /tmp/b2b400.json)"
  fi
fi

# B2B-02: GET outsider → 404 not_found, no quoted full_name/phone keys in body
if [[ -z "$API" || -z "$OUTSIDER_TOKEN" || -z "$DENIED_LEAD_ID" ]]; then
  skip_case "B2B-02" "missing API_URL and/or OUTSIDER_TOKEN and/or DENIED_LEAD_ID"
else
  code=$(curl -s -o /tmp/b2b404.json -w '%{http_code}' \
    -H "Authorization: Bearer $OUTSIDER_TOKEN" \
    "$API/api/v1/leads/$DENIED_LEAD_ID")
  if [[ "$code" == "404" ]] && grep -q not_found /tmp/b2b404.json && ! grep -qE '"(full_name|phone)"' /tmp/b2b404.json; then
    pass_case "B2B-02"
  else
    fail_case "B2B-02" "expected 404 not_found without full_name/phone, got HTTP $code error=$(json_error /tmp/b2b404.json)"
  fi
fi

# B2B-04: owner can GET own lead (plan: owner sees own when assign disabled)
if [[ -z "$OWNED_LEAD_ID" ]]; then
  skip_case "B2B-04" "missing OWNED_LEAD_ID"
elif [[ -z "$API" || -z "$STAFF_TOKEN" ]]; then
  skip_case "B2B-04" "missing API_URL and/or STAFF_TOKEN"
else
  code=$(curl -s -o /tmp/b2b200.json -w '%{http_code}' \
    -H "Authorization: Bearer $STAFF_TOKEN" \
    "$API/api/v1/leads/$OWNED_LEAD_ID")
  if [[ "$code" == "200" ]]; then
    pass_case "B2B-04"
  else
    fail_case "B2B-04" "expected HTTP 200, got HTTP $code error=$(json_error /tmp/b2b200.json)"
  fi
fi

# B2B-03, B2B-05 … B2B-18: not automated in W0 shell UAT (later waves)
for i in $(seq 3 18); do
  [[ "$i" -eq 4 ]] && continue
  id=$(printf 'B2B-%02d' "$i")
  skip_case "$id" "W0: not automated in shell UAT (later waves)"
done

echo "UAT summary: pass=$pass skip=$skip fail=$fail"
if [[ "$fail" -gt 0 ]]; then
  exit 1
fi
