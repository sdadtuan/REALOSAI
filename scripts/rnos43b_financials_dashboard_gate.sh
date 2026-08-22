#!/usr/bin/env bash
# RNOS-43B — Financials dashboard v2 gate
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

REPORT="${REPORT:-$ROOT/.local-dev/rnos43b-financials-dashboard-gate-report.json}"
pass=0
fail=0
results=()

log_ok() { pass=$((pass + 1)); results+=("{\"id\":\"$1\",\"status\":\"pass\",\"detail\":$(python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$2")}"); echo "PASS  $1 — $2"; }
log_fail() { fail=$((fail + 1)); results+=("{\"id\":\"$1\",\"status\":\"fail\",\"detail\":$(python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$2")}"); echo "FAIL  $1 — $2"; }

echo "== RNOS-43B Financials Dashboard v2 Gate =="

for f in \
  services/ops-web/src/components/kpi/DashboardShell.tsx \
  services/ops-web/src/components/kpi/FinancialLifecycleTable.tsx \
  services/ops-web/e2e/financials-dashboard-rnos43b.spec.ts \
  scripts/playwright_ops_financials_dashboard_v2_e2e.sh; do
  if [[ -f "$ROOT/$f" ]]; then
    log_ok "artifact-${f//\//-}" "Present"
  else
    log_fail "artifact-${f//\//-}" "Missing $f"
  fi
done

if grep -q 'DashboardShell' "$ROOT/services/ops-web/src/app/crm/financials/page.tsx"; then
  log_ok "financials-shell" "Financials page uses DashboardShell"
else
  log_fail "financials-shell" "Missing DashboardShell on /crm/financials"
fi

if grep -q 'FinancialLifecycleTable' "$ROOT/services/ops-web/src/app/crm/financials/page.tsx"; then
  log_ok "lifecycle-table" "Sortable lifecycle table wired"
else
  log_fail "lifecycle-table" "Missing FinancialLifecycleTable"
fi

if grep -q 'service-delivery' "$ROOT/services/ops-web/src/components/kpi/FinancialLifecycleTable.tsx"; then
  log_ok "lifecycle-drill" "Lifecycle drill link to service-delivery"
else
  log_fail "lifecycle-drill" "Missing service-delivery drill"
fi

if grep -q 'không thay ERP MISA' "$ROOT/services/ops-web/src/app/crm/financials/page.tsx"; then
  log_ok "erp-footer" "ERP disclaimer footer present"
else
  log_fail "erp-footer" "Missing ERP footer"
fi

if grep -q 'AR quá hạn' "$ROOT/services/ops-web/src/components/kpi/KpiDashboardUi.tsx"; then
  log_ok "tiles-expanded" "Expanded financial summary tiles"
else
  log_fail "tiles-expanded" "Missing expanded financial tiles"
fi

if grep -q 'test:e2e:financials-dashboard-v2' "$ROOT/services/ops-web/package.json"; then
  log_ok "npm-script" 'test:e2e:financials-dashboard-v2 in package.json'
else
  log_fail "npm-script" 'Add test:e2e:financials-dashboard-v2 script'
fi

echo "==> ops-web TypeScript check"
if (cd "$ROOT/services/ops-web" && npx tsc --noEmit); then
  log_ok "ops-web-typecheck" "tsc --noEmit OK"
else
  log_fail "ops-web-typecheck" "TypeScript check failed"
fi

if bash "$ROOT/scripts/playwright_ops_financials_dashboard_v2_e2e.sh"; then
  log_ok "playwright-e2e" "financials-dashboard-rnos43b.spec.ts PASS"
else
  log_fail "playwright-e2e" "Playwright Financials dashboard v2 E2E failed"
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
  "rnos": "RNOS-43B",
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
