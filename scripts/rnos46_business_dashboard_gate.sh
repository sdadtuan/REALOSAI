#!/usr/bin/env bash
# RNOS-46 — Business dashboard executive gate (12-week sparkline + attribution drill)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

REPORT="${REPORT:-$ROOT/.local-dev/rnos46-business-dashboard-gate-report.json}"
pass=0
fail=0
results=()

log_ok() { pass=$((pass + 1)); results+=("{\"id\":\"$1\",\"status\":\"pass\",\"detail\":$(python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$2")}"); echo "PASS  $1 — $2"; }
log_fail() { fail=$((fail + 1)); results+=("{\"id\":\"$1\",\"status\":\"fail\",\"detail\":$(python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$2")}"); echo "FAIL  $1 — $2"; }

echo "== RNOS-46 Business Dashboard Executive Gate =="

for f in \
  services/ptt-crm-api/src/finance/business-dashboard.util.ts \
  services/ptt-crm-api/src/finance/business-dashboard.util.spec.ts \
  services/ops-web/src/components/kpi/BusinessExecutivePanel.tsx \
  services/ops-web/e2e/business-dashboard-rnos46.spec.ts \
  scripts/playwright_ops_business_dashboard_e2e.sh; do
  if [[ -f "$ROOT/$f" ]]; then
    log_ok "artifact-${f//\//-}" "Present"
  else
    log_fail "artifact-${f//\//-}" "Missing $f"
  fi
done

if grep -q 'BusinessExecutivePanel' "$ROOT/services/ops-web/src/app/crm/business-dashboard/page.tsx"; then
  log_ok "ui-panel" "BusinessExecutivePanel wired on business-dashboard"
else
  log_fail "ui-panel" "Missing BusinessExecutivePanel on page"
fi

if grep -q 'getBusinessDashboardExecutive' "$ROOT/services/ptt-crm-api/src/finance/finance-sqlite.repository.ts"; then
  log_ok "api-executive" "executive block in businessDashboard repository"
else
  log_fail "api-executive" "Missing getBusinessDashboardExecutive wiring"
fi

if grep -q 'business-executive-panel' "$ROOT/services/ops-web/src/app/globals.css"; then
  log_ok "css-panel" "business-executive-panel styles present"
else
  log_fail "css-panel" "Missing CSS for executive panel"
fi

if grep -q 'test:e2e:business-dashboard-executive' "$ROOT/services/ops-web/package.json"; then
  log_ok "npm-script" 'test:e2e:business-dashboard-executive in package.json'
else
  log_fail "npm-script" 'Add test:e2e:business-dashboard-executive script'
fi

echo "==> ptt-crm-api unit tests (business-dashboard.util)"
if (cd "$ROOT/services/ptt-crm-api" && npm test -- business-dashboard.util.spec.ts --passWithNoTests 2>/dev/null); then
  log_ok "api-unit" "business-dashboard.util.spec.ts PASS"
else
  log_fail "api-unit" "business-dashboard.util unit tests failed"
fi

echo "==> ptt-crm-api TypeScript check"
if (cd "$ROOT/services/ptt-crm-api" && npx tsc --noEmit); then
  log_ok "api-typecheck" "tsc --noEmit OK"
else
  log_fail "api-typecheck" "TypeScript check failed"
fi

echo "==> ops-web TypeScript check"
if (cd "$ROOT/services/ops-web" && npx tsc --noEmit); then
  log_ok "ops-web-typecheck" "tsc --noEmit OK"
else
  log_fail "ops-web-typecheck" "TypeScript check failed"
fi

if bash "$ROOT/scripts/playwright_ops_business_dashboard_e2e.sh"; then
  log_ok "playwright-e2e" "business-dashboard-rnos46.spec.ts PASS"
else
  log_fail "playwright-e2e" "Playwright RNOS-46 E2E failed"
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
  "rnos": "RNOS-46",
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
