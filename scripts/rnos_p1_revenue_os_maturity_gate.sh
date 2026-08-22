#!/usr/bin/env bash
# P1 — UAT & Revenue OS maturity gate (AI-UC-013/015/017 + §19.3 #2)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
REPORT="${REPORT:-$ROOT/.local-dev/rnos-p1-revenue-os-maturity-gate-report.json}"
pass=0; fail=0; results=()
log_ok() { pass=$((pass+1)); results+=("{\"id\":\"$1\",\"status\":\"pass\",\"detail\":$(python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$2")}"); echo "PASS  $1 — $2"; }
log_fail() { fail=$((fail+1)); results+=("{\"id\":\"$1\",\"status\":\"fail\",\"detail\":$(python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$2")}"); echo "FAIL  $1 — $2"; }

echo "== P1 Revenue OS Maturity Gate =="

for f in \
  services/ptt-crm-api/src/ai-intelligence/ai-forecast.service.ts \
  services/ptt-crm-api/src/ai-intelligence/pipeline-risk.service.ts \
  services/ptt-crm-api/src/ai-intelligence/ai-churn-health.service.ts \
  services/ops-web/src/components/ai/ForecastVariancePanel.tsx \
  services/ops-web/src/components/ai/ForecastMapeReportPanel.tsx \
  services/ops-web/src/components/ai/PipelineRiskPanel.tsx \
  services/ops-web/src/components/ai/CsHealthDashboardPanel.tsx; do
  [[ -f "$ROOT/$f" ]] && log_ok "artifact-${f//\//-}" "Present" || log_fail "artifact-${f//\//-}" "Missing $f"
done

grep -q "forecast/variance" "$ROOT/services/ptt-crm-api/src/ai-intelligence/ai-intelligence.controller.ts" && log_ok api-variance "GET forecast/variance" || log_fail api-variance "Missing variance endpoint"
grep -q "forecast/mape-report" "$ROOT/services/ptt-crm-api/src/ai-intelligence/ai-intelligence.controller.ts" && log_ok api-mape "GET forecast/mape-report" || log_fail api-mape "Missing MAPE report endpoint"
grep -q "pipeline-risk/:id/assign" "$ROOT/services/ptt-crm-api/src/ai-intelligence/ai-intelligence.controller.ts" && log_ok api-assign "PATCH pipeline-risk assign" || log_fail api-assign "Missing assign endpoint"
grep -q "pipeline-risk/:id/activity" "$ROOT/services/ptt-crm-api/src/ai-intelligence/ai-intelligence.controller.ts" && log_ok api-activity "POST pipeline-risk activity" || log_fail api-activity "Missing activity endpoint"
grep -q "health/recovery-plan" "$ROOT/services/ptt-crm-api/src/ai-intelligence/ai-intelligence.controller.ts" && log_ok api-recovery "POST health/recovery-plan" || log_fail api-recovery "Missing recovery plan endpoint"
grep -q "fetchForecastVariance" "$ROOT/services/ops-web/src/lib/ai-api.ts" && log_ok ai-client-variance "fetchForecastVariance" || log_fail ai-client-variance "Missing ai-api variance client"
grep -q "fetchForecastMapeReport" "$ROOT/services/ops-web/src/lib/ai-api.ts" && log_ok ai-client-mape "fetchForecastMapeReport" || log_fail ai-client-mape "Missing ai-api MAPE client"
grep -q "ForecastVariancePanel" "$ROOT/services/ops-web/src/app/crm/business-dashboard/page.tsx" && log_ok ui-variance "Business dashboard variance panel" || log_fail ui-variance "Missing variance UI"
grep -q "ForecastMapeReportPanel" "$ROOT/services/ops-web/src/app/crm/business-dashboard/page.tsx" && log_ok ui-mape "Business dashboard MAPE report" || log_fail ui-mape "Missing MAPE report UI"
grep -q "patchPipelineRiskAssign" "$ROOT/services/ops-web/src/app/crm/ai/insights/page.tsx" && log_ok ui-assign "Pipeline assign owner wired" || log_fail ui-assign "Missing assign UI wiring"
grep -q "postChurnRecoveryPlan" "$ROOT/services/ops-web/src/components/ai/CsHealthDashboardPanel.tsx" && log_ok ui-recovery "Health recovery plan UI" || log_fail ui-recovery "Missing recovery UI"
grep -q "Variance | ✓ P1" "$ROOT/docs/use-cases/actions/09-AI-ACTIONS.md" && log_ok doc-uc013 "AI-UC-013 step 7 marked" || log_fail doc-uc013 "Missing UC doc update"

(cd "$ROOT/services/ptt-crm-api" && npm test -- pipeline-risk.service.spec.ts ai-churn-health.service.spec.ts ai-forecast.service.spec.ts --passWithNoTests 2>/dev/null) && log_ok api-unit "P1 unit specs PASS" || log_fail api-unit "Unit tests failed"
(cd "$ROOT/services/ptt-crm-api" && npx tsc --noEmit) && log_ok api-typecheck "tsc OK" || log_fail api-typecheck "tsc failed"
(cd "$ROOT/services/ops-web" && npx tsc --noEmit) && log_ok ops-typecheck "tsc OK" || log_fail ops-typecheck "tsc failed"

mkdir -p "$(dirname "$REPORT")"
TMP="$(mktemp)"; printf '%s\n' "${results[@]}" > "$TMP"
python3 - <<PY
import json, datetime
from pathlib import Path
checks=[json.loads(l) for l in Path("$TMP").read_text().splitlines() if l.strip()]
report={"generated_at":datetime.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),"rnos":"P1-Revenue-OS-Maturity","summary":{"pass":$pass,"fail":$fail},"checks":checks}
Path("$REPORT").write_text(json.dumps(report,indent=2,ensure_ascii=False)+"\\n")
print(json.dumps(report,indent=2,ensure_ascii=False))
PY
rm -f "$TMP"
echo "PASS=$pass FAIL=$fail"; [[ "$fail" -eq 0 ]]
