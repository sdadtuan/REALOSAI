#!/usr/bin/env bash
# RNOS-45 — Financial intelligence gate
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

REPORT="${REPORT:-$ROOT/.local-dev/rnos45-financials-intelligence-gate-report.json}"
pass=0
fail=0
results=()

log_ok() { pass=$((pass + 1)); results+=("{\"id\":\"$1\",\"status\":\"pass\",\"detail\":$(python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$2")}"); echo "PASS  $1 — $2"; }
log_fail() { fail=$((fail + 1)); results+=("{\"id\":\"$1\",\"status\":\"fail\",\"detail\":$(python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$2")}"); echo "FAIL  $1 — $2"; }

echo "== RNOS-45 Financial Intelligence Gate =="

for f in \
  services/ptt-crm-api/src/finance/finance-intelligence.util.ts \
  services/ops-web/src/components/kpi/FinancialIntelligencePanel.tsx \
  services/ops-web/e2e/financials-intelligence-rnos45.spec.ts \
  scripts/playwright_ops_financials_intelligence_e2e.sh; do
  if [[ -f "$ROOT/$f" ]]; then
    log_ok "artifact-${f//\//-}" "Present"
  else
    log_fail "artifact-${f//\//-}" "Missing $f"
  fi
done

if grep -q 'FinancialIntelligencePanel' "$ROOT/services/ops-web/src/app/crm/financials/page.tsx"; then
  log_ok "financials-intel-panel" "Financial intelligence panel wired"
else
  log_fail "financials-intel-panel" "Missing FinancialIntelligencePanel"
fi

if grep -q "@Get('intelligence')" "$ROOT/services/ptt-crm-api/src/finance/finance.controller.ts"; then
  log_ok "api-intelligence" "GET /api/crm/finance/intelligence present"
else
  log_fail "api-intelligence" "Missing intelligence endpoint"
fi

if grep -q 'fetchFinanceIntelligence' "$ROOT/services/ops-web/src/lib/api.ts"; then
  log_ok "api-client" "fetchFinanceIntelligence in api.ts"
else
  log_fail "api-client" "Missing fetchFinanceIntelligence"
fi

if grep -q 'financials-payment-gate--blocked' "$ROOT/services/ops-web/src/components/kpi/FinancialLifecycleTable.tsx"; then
  log_ok "payment-gate-badge" "Payment gate blocked badge on lifecycle table"
else
  log_fail "payment-gate-badge" "Missing payment gate badge"
fi

if grep -q 'Cần xử lý' "$ROOT/services/ops-web/src/components/kpi/FinancialIntelligencePanel.tsx"; then
  log_ok "action-list" "Action list section present"
else
  log_fail "action-list" "Missing action list"
fi

if grep -q 'test:e2e:financials-intelligence' "$ROOT/services/ops-web/package.json"; then
  log_ok "npm-script" 'test:e2e:financials-intelligence in package.json'
else
  log_fail "npm-script" 'Add test:e2e:financials-intelligence script'
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

if bash "$ROOT/scripts/playwright_ops_financials_intelligence_e2e.sh"; then
  log_ok "playwright-e2e" "financials-intelligence-rnos45.spec.ts PASS"
else
  log_fail "playwright-e2e" "Playwright financial intelligence E2E failed"
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
  "rnos": "RNOS-45",
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
