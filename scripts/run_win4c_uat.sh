#!/usr/bin/env bash
# WIN-4-C UAT — OPA policy + CPL digest + budget recommend.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
if [[ -f "$ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env"
  set +a
fi

API="${WIN4C_API:-http://127.0.0.1:3000}"
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

echo "== WIN-4-C UAT =="

health="$(curl -sf "$API/health" 2>/dev/null || echo '{}')"
policy_ver="$(echo "$health" | python3 -c "import json,sys; print(json.load(sys.stdin).get('policy_bundle_version') or '')" 2>/dev/null || echo '')"
policy_on="$(echo "$health" | python3 -c "import json,sys; print(json.load(sys.stdin).get('staff_policy_opa'))" 2>/dev/null || echo false)"
if [[ "$policy_on" == "True" || "$policy_on" == "true" ]]; then
  check EC-W4C-05 "$([[ -n "$policy_ver" ]] && echo 1 || echo 0)" "policy_bundle_version=$policy_ver"
else
  check EC-W4C-05 1 "STAFF_POLICY_OPA off — skipped"
fi

bash "$ROOT/scripts/deploy_opa_bundle.sh" >/dev/null && check EC-W4C-05b 1 "opa bundle gate" || check EC-W4C-05b 0 "opa bundle gate"

cpl_code="$(curl -sf -o /dev/null -w '%{http_code}' "$API/api/v1/ai/cpl-digest" -H "Authorization: Bearer ${WIN4C_ADMIN_TOKEN:-}" 2>/dev/null || echo 000)"
if [[ -n "${WIN4C_ADMIN_TOKEN:-}" ]]; then
  check EC-W4C-06 "$([[ "$cpl_code" == "200" ]] && echo 1 || echo 0)" "GET cpl-digest HTTP $cpl_code"
else
  check EC-W4C-06 1 "cpl-digest skipped (set WIN4C_ADMIN_TOKEN)"
fi

budget_code="$(curl -sf -o /dev/null -w '%{http_code}' "$API/api/v1/ai/budget-recommendations" -H "Authorization: Bearer ${WIN4C_ADMIN_TOKEN:-}" 2>/dev/null || echo 000)"
if [[ -n "${WIN4C_ADMIN_TOKEN:-}" ]]; then
  check EC-W4C-07 "$([[ "$budget_code" == "200" ]] && echo 1 || echo 0)" "GET budget-recommendations HTTP $budget_code"
else
  check EC-W4C-07 1 "budget API skipped (set WIN4C_ADMIN_TOKEN)"
fi

echo "Summary: $pass PASS / $fail FAIL"
[[ "$fail" -eq 0 ]]
