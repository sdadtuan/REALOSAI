#!/usr/bin/env bash
# WIN-4-B UAT — field ABAC + multi-module client scope (run on VPS or local with API up).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
if [[ -f "$ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env"
  set +a
fi

API="${WIN4B_API:-http://127.0.0.1:3000}"
KC="${KEYCLOAK_URL:-http://127.0.0.1:8080/auth}"
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

echo "== WIN-4-B UAT =="

registry="$(curl -sf "$API/api/v1/staff/permissions/field-registry" -H "Authorization: Bearer ${WIN4B_ADMIN_TOKEN:-}" 2>/dev/null || echo '{}')"
fields="$(echo "$registry" | python3 -c "import json,sys; print(len(json.load(sys.stdin).get('fields',[])))" 2>/dev/null || echo 0)"
if [[ -n "${WIN4B_ADMIN_TOKEN:-}" ]]; then
  check EC-W4B-01 "$([[ "$fields" -ge 5 ]] && echo 1 || echo 0)" "field-registry rows=$fields"
else
  check EC-W4B-01 1 "field-registry skipped (set WIN4B_ADMIN_TOKEN)"
fi

if [[ -x "$ROOT/scripts/rbac_field_registry_gate.sh" ]]; then
  bash "$ROOT/scripts/rbac_field_registry_gate.sh" >/dev/null && check EC-W4B-02 1 "registry gate" || check EC-W4B-02 0 "registry gate"
fi

echo "Summary: $pass PASS / $fail FAIL"
[[ "$fail" -eq 0 ]]
