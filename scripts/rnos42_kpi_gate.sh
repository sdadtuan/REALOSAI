#!/usr/bin/env bash
# RNOS-42 — KPI dashboard UX gate (tiles + charts + E2E)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

REPORT="${REPORT:-$ROOT/.local-dev/rnos42-kpi-gate-report.json}"
pass=0
fail=0
results=()

log_ok() { pass=$((pass + 1)); results+=("{\"id\":\"$1\",\"status\":\"pass\",\"detail\":$(python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$2")}"); echo "PASS  $1 — $2"; }
log_fail() { fail=$((fail + 1)); results+=("{\"id\":\"$1\",\"status\":\"fail\",\"detail\":$(python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$2")}"); echo "FAIL  $1 — $2"; }

echo "== RNOS-42 KPI UX Gate =="

for f in \
  services/ops-web/src/components/kpi/KpiDashboardUi.tsx \
  services/ops-web/src/lib/kpi/format.ts \
  services/ops-web/src/app/crm/kpi/page.tsx \
  services/ops-web/src/app/crm/business-dashboard/page.tsx \
  services/ops-web/src/app/crm/staff-kpi/page.tsx \
  services/ops-web/src/app/crm/owner-weekly/page.tsx \
  services/ops-web/src/app/crm/financials/page.tsx \
  services/ops-web/e2e/kpi-rnos42.spec.ts \
  scripts/playwright_ops_kpi_e2e.sh; do
  if [[ -f "$ROOT/$f" ]]; then
    log_ok "artifact-${f//\//-}" "Present"
  else
    log_fail "artifact-${f//\//-}" "Missing $f"
  fi
done

if grep -q 'kpi-tile-grid' "$ROOT/services/ops-web/src/app/globals.css"; then
  log_ok "css-kpi" "KPI dashboard CSS present"
else
  log_fail "css-kpi" "Missing KPI CSS"
fi

if grep -q 'owner-weekly-grid' "$ROOT/services/ops-web/src/app/globals.css"; then
  log_ok "css-owner-weekly" "Owner weekly CSS present"
else
  log_fail "css-owner-weekly" "Missing owner-weekly CSS"
fi

if grep -q 'OwnerWeeklyBlockGrid' "$ROOT/services/ops-web/src/app/crm/owner-weekly/page.tsx"; then
  log_ok "page-owner-weekly" "owner-weekly uses structured UI"
else
  log_fail "page-owner-weekly" "owner-weekly still JSON dump or missing components"
fi

if grep -q 'ArAgingPanel' "$ROOT/services/ops-web/src/app/crm/financials/page.tsx"; then
  log_ok "page-financials" "financials uses ArAgingPanel"
else
  log_fail "page-financials" "financials still JSON dump or missing ArAgingPanel"
fi

if grep -q 'fetchKpiBoard' "$ROOT/services/ops-web/src/lib/api.ts"; then
  log_ok "api-board" "fetchKpiBoard in api.ts"
else
  log_fail "api-board" "Missing fetchKpiBoard"
fi

if grep -q 'test:e2e:kpi' "$ROOT/services/ops-web/package.json"; then
  log_ok "npm-script" 'test:e2e:kpi in package.json'
else
  log_fail "npm-script" 'Add test:e2e:kpi script'
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

if bash "$ROOT/scripts/playwright_ops_kpi_e2e.sh"; then
  log_ok "playwright-e2e" "kpi-rnos42.spec.ts PASS"
else
  log_fail "playwright-e2e" "Playwright KPI E2E failed"
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
  "rnos": "RNOS-42",
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
