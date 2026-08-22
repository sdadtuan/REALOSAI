#!/usr/bin/env bash
# RNOS-44 — KPI editable grid gate
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

REPORT="${REPORT:-$ROOT/.local-dev/rnos44-kpi-grid-gate-report.json}"
pass=0
fail=0
results=()

log_ok() { pass=$((pass + 1)); results+=("{\"id\":\"$1\",\"status\":\"pass\",\"detail\":$(python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$2")}"); echo "PASS  $1 — $2"; }
log_fail() { fail=$((fail + 1)); results+=("{\"id\":\"$1\",\"status\":\"fail\",\"detail\":$(python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$2")}"); echo "FAIL  $1 — $2"; }

echo "== RNOS-44 KPI Editable Grid Gate =="

for f in \
  services/ops-web/src/components/kpi/KpiEditableGrid.tsx \
  services/ops-web/e2e/kpi-grid-rnos44.spec.ts \
  scripts/playwright_ops_kpi_grid_e2e.sh; do
  if [[ -f "$ROOT/$f" ]]; then
    log_ok "artifact-${f//\//-}" "Present"
  else
    log_fail "artifact-${f//\//-}" "Missing $f"
  fi
done

if grep -q 'KpiEditableGrid' "$ROOT/services/ops-web/src/app/crm/kpi/page.tsx"; then
  log_ok "kpi-page-grid" "/crm/kpi uses KpiEditableGrid"
else
  log_fail "kpi-page-grid" "Missing KpiEditableGrid on /crm/kpi"
fi

if grep -q 'fetchStaffKpi' "$ROOT/services/ops-web/src/lib/api.ts"; then
  log_ok "api-fetch-grid" "fetchStaffKpi in api.ts"
else
  log_fail "api-fetch-grid" "Missing fetchStaffKpi"
fi

if grep -q 'patchStaffKpiProgress' "$ROOT/services/ops-web/src/lib/api.ts"; then
  log_ok "api-patch" "patchStaffKpiProgress in api.ts"
else
  log_fail "api-patch" "Missing patchStaffKpiProgress"
fi

if grep -q 'actual_value phải' "$ROOT/services/ptt-crm-api/src/kpi/kpi.service.ts"; then
  log_ok "api-validation" "PATCH actual validation in kpi.service"
else
  log_fail "api-validation" "Missing actual_value validation"
fi

if grep -q 'kpi-editable-grid' "$ROOT/services/ops-web/src/app/globals.css"; then
  log_ok "css-grid" "KPI editable grid CSS present"
else
  log_fail "css-grid" "Missing KPI grid CSS"
fi

if grep -q 'test:e2e:kpi-grid' "$ROOT/services/ops-web/package.json"; then
  log_ok "npm-script" 'test:e2e:kpi-grid in package.json'
else
  log_fail "npm-script" 'Add test:e2e:kpi-grid script'
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

if bash "$ROOT/scripts/playwright_ops_kpi_grid_e2e.sh"; then
  log_ok "playwright-e2e" "kpi-grid-rnos44.spec.ts PASS"
else
  log_fail "playwright-e2e" "Playwright KPI grid E2E failed"
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
  "rnos": "RNOS-44",
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
