#!/usr/bin/env bash
# M7 — Content Marketing P0 UAT runner (automated + report)
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
TOKEN="${STAFF_JWT:-${CRM_STAFF_TOKEN:-${STAFF_TOKEN:-}}}"
INTERNAL_KEY="${PTT_CRM_INTERNAL_KEY:-}"
EMAIL="${ADMIN_EMAIL:-${OPS_E2E_STAFF_EMAIL:-admin@pttads.vn}}"
PASS="${ADMIN_PASSWORD:-${OPS_E2E_STAFF_PASSWORD:-}}"
REPORT_DIR="$ROOT/docs/exports"
REPORT_FILE="$REPORT_DIR/cmkt-uat-p0-$(date +%Y%m%d-%H%M%S).md"
mkdir -p "$REPORT_DIR"

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
  echo "FAIL set STAFF_JWT, ADMIN_PASSWORD, or PTT_CRM_INTERNAL_KEY"
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
PASS_COUNT=0
FAIL_COUNT=0

log_result() {
  local name="$1"
  local status="$2"
  local detail="${3:-}"
  if [[ "$status" == "PASS" ]]; then
    PASS_COUNT=$((PASS_COUNT + 1))
  else
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
  echo "| $name | $status | $detail |" >>"$REPORT_FILE"
}

{
  echo "# Content Marketing P0 UAT Report"
  echo ""
  echo "- Date: $(date -Iseconds 2>/dev/null || date)"
  echo "- Lifecycle: #$LIFECYCLE_ID"
  echo "- API: $API_BASE"
  echo ""
  echo "## Automated checks"
  echo ""
  echo "| Step | Result | Detail |"
  echo "|------|--------|--------|"
} >"$REPORT_FILE"

echo "==> M7 UAT runner lifecycle #$LIFECYCLE_ID"

if bash "$ROOT/scripts/smoke_content_marketing_p0.sh"; then
  log_result "smoke_content_marketing_p0.sh" "PASS" "exit 0"
else
  log_result "smoke_content_marketing_p0.sh" "FAIL" "see stdout"
  echo "FAIL smoke p0"
  echo "Report: $REPORT_FILE"
  exit 1
fi

# Reject without comment must return 400 (UAT criteria)
REJECT_ITEM_JSON="$(curl -sf "${AUTH[@]}" -H 'Content-Type: application/json' \
  -d '{"title":"UAT reject gate","channel":"facebook","format":"social_post","body_json":{"markdown":"body for reject test"}}' \
  -X POST "$BASE/items")"
REJECT_ITEM_ID="$(echo "$REJECT_ITEM_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")"
curl -sf "${AUTH[@]}" -X POST "$BASE/items/$REJECT_ITEM_ID/submit-review" >/dev/null
REJECT_CODE="$(curl -s -o /dev/null -w '%{http_code}' "${AUTH[@]}" -H 'Content-Type: application/json' \
  -d '{"comment":"short"}' -X POST "$BASE/items/$REJECT_ITEM_ID/reject")"
if [[ "$REJECT_CODE" == "400" ]]; then
  log_result "reject_no_comment_400" "PASS" "HTTP $REJECT_CODE"
else
  log_result "reject_no_comment_400" "FAIL" "HTTP $REJECT_CODE expected 400"
fi

AUDIT_ROWS="$(curl -sf "${AUTH[@]}" "$BASE/audit?limit=5" \
  | python3 -c "import sys,json; print(len(json.load(sys.stdin).get('audit') or []))" 2>/dev/null || echo 0)"
if [[ "$AUDIT_ROWS" -ge 0 ]]; then
  log_result "GET audit" "PASS" "rows=$AUDIT_ROWS"
else
  log_result "GET audit" "FAIL" "request failed"
fi

{
  echo ""
  echo "## Summary"
  echo ""
  echo "- PASS: $PASS_COUNT"
  echo "- FAIL: $FAIL_COUNT"
  echo ""
  echo "## Manual UAT (18 bước)"
  echo ""
  echo "Chạy checklist: \`docs/runbooks/content-marketing-uat-p0.md\`"
  echo ""
  echo "## PO sign-off"
  echo ""
  echo "- [ ] PO đã xác nhận 18 bước manual PASS trên staging"
  echo "- [ ] PO ký ngày: ___________"
} >>"$REPORT_FILE"

if [[ "$FAIL_COUNT" -gt 0 ]]; then
  echo "FAIL UAT automated ($FAIL_COUNT failures). Report: $REPORT_FILE"
  exit 1
fi

echo "PASS M7 UAT automated ($PASS_COUNT checks). Report: $REPORT_FILE"
echo "$REPORT_FILE"
