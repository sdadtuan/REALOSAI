#!/usr/bin/env bash
# RNOS-35 — CRM custom fields + pipeline admin gate
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

REPORT="${REPORT:-$ROOT/.local-dev/rnos35-crm-config-gate-report.json}"
pass=0
fail=0
results=()

log_ok() { pass=$((pass + 1)); results+=("{\"id\":\"$1\",\"status\":\"pass\",\"detail\":$(python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$2")}"); echo "PASS  $1 — $2"; }
log_fail() { fail=$((fail + 1)); results+=("{\"id\":\"$1\",\"status\":\"fail\",\"detail\":$(python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$2")}"); echo "FAIL  $1 — $2"; }

echo "== RNOS-35 CRM Config Gate =="

for f in \
  services/ptt-crm-api/src/crm-config/crm-config.module.ts \
  services/ptt-crm-api/src/crm-config/crm-config.controller.ts \
  services/ops-web/src/app/admin/crm/custom-fields/page.tsx \
  services/ops-web/src/app/admin/crm/pipeline/page.tsx \
  services/ops-web/e2e/crm-config-rnos35.spec.ts \
  scripts/playwright_ops_crm_config_e2e.sh; do
  if [[ -f "$ROOT/$f" ]]; then
    log_ok "artifact-${f//\//-}" "Present"
  else
    log_fail "artifact-${f//\//-}" "Missing $f"
  fi
done

if grep -q 'admin-crm-subnav' "$ROOT/services/ops-web/src/app/globals.css"; then
  log_ok "css-admin-crm" "Admin CRM CSS present"
else
  log_fail "css-admin-crm" "Missing admin CRM CSS"
fi

if grep -q 'crm_data_config' "$ROOT/services/ptt-crm-api/src/staff-auth/staff-auth.service.ts"; then
  log_ok "rbac-caps" "crm_data_config caps in stub auth"
else
  log_fail "rbac-caps" "Missing crm_data_config caps"
fi

if grep -q 'fetchCrmCustomFields' "$ROOT/services/ops-web/src/lib/api.ts"; then
  log_ok "api-helpers" "CRM config API helpers present"
else
  log_fail "api-helpers" "Missing CRM config API helpers"
fi

if grep -q 'test:e2e:crm-config' "$ROOT/services/ops-web/package.json"; then
  log_ok "npm-script" 'test:e2e:crm-config in package.json'
else
  log_fail "npm-script" 'Add test:e2e:crm-config script'
fi

echo "==> ptt-crm-api TypeScript check"
if (
  cd "$ROOT/services/ptt-crm-api"
  npx tsc --noEmit
); then
  log_ok "api-typecheck" "tsc --noEmit OK"
else
  log_fail "api-typecheck" "TypeScript check failed"
fi

echo "==> ops-web TypeScript check"
if (
  cd "$ROOT/services/ops-web"
  npx tsc --noEmit
); then
  log_ok "ops-web-typecheck" "tsc --noEmit OK"
else
  log_fail "ops-web-typecheck" "TypeScript check failed"
fi

if bash "$ROOT/scripts/playwright_ops_crm_config_e2e.sh"; then
  log_ok "playwright-e2e" "crm-config-rnos35.spec.ts PASS"
else
  log_fail "playwright-e2e" "Playwright CRM config E2E failed"
fi

mkdir -p "$(dirname "$REPORT")"
TMP_RESULTS="$(mktemp)"
printf '%s\n' "${results[@]}" > "$TMP_RESULTS"
python3 - <<PY
import json, datetime
from pathlib import Path
lines = [l for l in Path("$TMP_RESULTS").read_text().splitlines() if l.strip()]
checks = [json.loads(l) for l in lines]
report = {
  "generated_at": datetime.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
  "rnos": "RNOS-35",
  "summary": {"pass": $pass, "fail": $fail},
  "checks": checks,
}
Path("$REPORT").write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\\n")
print(json.dumps(report, indent=2, ensure_ascii=False))
PY
rm -f "$TMP_RESULTS"

echo ""
echo "Gate report: $REPORT"
echo "PASS=$pass FAIL=$fail"
[[ "$fail" -eq 0 ]]
