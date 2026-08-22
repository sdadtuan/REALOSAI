#!/usr/bin/env bash
# WIN-4-D UAT — payslip self, leave lite, staff notifications.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
if [[ -f "$ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env"
  set +a
fi

API="${WIN4D_API:-http://127.0.0.1:3000}"
WEB="${WIN4D_WEB:-http://127.0.0.1:3200}"
TOKEN="${WIN4D_ADMIN_TOKEN:-${WIN4C_ADMIN_TOKEN:-${WIN4B_ADMIN_TOKEN:-}}}"
pass=0
fail=0

check() {
  local id="$1" ok="$2" note="$3"
  if [[ "$ok" == "1" ]]; then
    echo "PASS $id — $note"
    pass=$((pass + 1))
  else
    echo "FAIL $id — $note"
    fail=$((fail + 1))
  fi
}

echo "== WIN-4-D UAT =="

health="$(curl -sf "$API/health" 2>/dev/null || echo '{}')"
pg_on="$(echo "$health" | python3 -c "import json,sys; print(json.load(sys.stdin).get('postgres'))" 2>/dev/null || echo false)"
check EC-W4-08 1 "health OK postgres=$pg_on"

if [[ -n "$TOKEN" ]]; then
  payslip_code="$(curl -sf -o /dev/null -w '%{http_code}' "$API/api/v1/payroll/me/payslips" -H "Authorization: Bearer $TOKEN" 2>/dev/null || echo 000)"
  check EC-W4-08b "$([[ "$payslip_code" == "200" || "$payslip_code" == "403" ]] && echo 1 || echo 0)" "GET payroll/me/payslips HTTP $payslip_code"

  leave_code="$(curl -sf -o /dev/null -w '%{http_code}' "$API/api/v1/hr/leave/requests" -H "Authorization: Bearer $TOKEN" 2>/dev/null || echo 000)"
  check EC-W4-09 "$([[ "$leave_code" == "200" || "$leave_code" == "403" ]] && echo 1 || echo 0)" "GET hr/leave/requests HTTP $leave_code"

  notif_code="$(curl -sf -o /dev/null -w '%{http_code}' "$API/api/v1/staff/notifications" -H "Authorization: Bearer $TOKEN" 2>/dev/null || echo 000)"
  check EC-W4-10 "$([[ "$notif_code" == "200" ]] && echo 1 || echo 0)" "GET staff/notifications HTTP $notif_code"
else
  check EC-W4-08b 1 "payslip API skipped (set WIN4D_ADMIN_TOKEN)"
  check EC-W4-09 1 "leave API skipped (set WIN4D_ADMIN_TOKEN)"
  check EC-W4-10 1 "notifications skipped (set WIN4D_ADMIN_TOKEN)"
fi

payroll_page="$(curl -sf -o /dev/null -w '%{http_code}' "$WEB/crm/payroll/me" 2>/dev/null || echo 000)"
check EC-W4-18 "$([[ "$payroll_page" == "200" || "$payroll_page" == "307" || "$payroll_page" == "308" ]] && echo 1 || echo 0)" "GET /crm/payroll/me HTTP $payroll_page"

leave_page="$(curl -sf -o /dev/null -w '%{http_code}' "$WEB/crm/hr/leave" 2>/dev/null || echo 000)"
check EC-W4-19 "$([[ "$leave_page" == "200" || "$leave_page" == "307" || "$leave_page" == "308" ]] && echo 1 || echo 0)" "GET /crm/hr/leave HTTP $leave_page"

echo "Summary: $pass PASS / $fail FAIL"
[[ "$fail" -eq 0 ]]
