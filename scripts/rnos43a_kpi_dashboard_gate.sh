#!/usr/bin/env bash
# RNOS-43A — KPI dashboard v2 gate
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

REPORT="${REPORT:-$ROOT/.local-dev/rnos43a-kpi-dashboard-gate-report.json}"
pass=0
fail=0
results=()

log_ok() { pass=$((pass + 1)); results+=("{\"id\":\"$1\",\"status\":\"pass\",\"detail\":$(python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$2")}"); echo "PASS  $1 — $2"; }
log_fail() { fail=$((fail + 1)); results+=("{\"id\":\"$1\",\"status\":\"fail\",\"detail\":$(python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$2")}"); echo "FAIL  $1 — $2"; }

echo "== RNOS-43A KPI Dashboard v2 Gate =="

for f in \
  services/ops-web/src/components/kpi/DashboardShell.tsx \
  services/ptt-crm-api/src/kpi/kpi-export.util.ts \
  services/ops-web/e2e/kpi-dashboard-rnos43a.spec.ts \
  scripts/playwright_ops_kpi_dashboard_v2_e2e.sh; do
  if [[ -f "$ROOT/$f" ]]; then
    log_ok "artifact-${f//\//-}" "Present"
  else
    log_fail "artifact-${f//\//-}" "Missing $f"
  fi
done

if grep -q 'DashboardShell' "$ROOT/services/ops-web/src/app/crm/kpi/page.tsx"; then
  log_ok "kpi-shell" "KPI page uses DashboardShell"
else
  log_fail "kpi-shell" "Missing DashboardShell on /crm/kpi"
fi

if grep -q 'fetchKpiMetricTrend' "$ROOT/services/ops-web/src/lib/api.ts"; then
  log_ok "api-trend" "KPI trend API helper present"
else
  log_fail "api-trend" "Missing fetchKpiMetricTrend"
fi

if grep -q 'export.xlsx' "$ROOT/services/ptt-crm-api/src/kpi/staff-kpi-progress.controller.ts"; then
  log_ok "api-export-xlsx" "Staff KPI Excel export endpoint present"
else
  log_fail "api-export-xlsx" "Missing export.xlsx endpoint"
fi

if grep -q 'Export Excel' "$ROOT/services/ops-web/src/app/crm/kpi/page.tsx"; then
  log_ok "ui-export-excel" "Export Excel button on KPI page"
else
  log_fail "ui-export-excel" "Missing Export Excel button"
fi

if grep -q '/crm/staff/' "$ROOT/services/ops-web/src/components/kpi/KpiDashboardUi.tsx"; then
  log_ok "alert-drill" "KPI alerts link to staff profile"
else
  log_fail "alert-drill" "Missing staff drill in alerts"
fi

if grep -q 'test:e2e:kpi-dashboard-v2' "$ROOT/services/ops-web/package.json"; then
  log_ok "npm-script" 'test:e2e:kpi-dashboard-v2 in package.json'
else
  log_fail "npm-script" 'Add test:e2e:kpi-dashboard-v2 script'
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

if bash "$ROOT/scripts/playwright_ops_kpi_dashboard_v2_e2e.sh"; then
  log_ok "playwright-e2e" "kpi-dashboard-rnos43a.spec.ts PASS"
else
  log_fail "playwright-e2e" "Playwright KPI dashboard v2 E2E failed"
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
  "rnos": "RNOS-43A",
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
