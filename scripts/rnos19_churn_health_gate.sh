#!/usr/bin/env bash
# RNOS-19 / AI-UC-017 — Churn health score gate
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
REPORT="${REPORT:-$ROOT/.local-dev/rnos19-churn-health-gate-report.json}"
pass=0; fail=0; results=()
log_ok() { pass=$((pass+1)); results+=("{\"id\":\"$1\",\"status\":\"pass\",\"detail\":$(python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$2")}"); echo "PASS  $1 — $2"; }
log_fail() { fail=$((fail+1)); results+=("{\"id\":\"$1\",\"status\":\"fail\",\"detail\":$(python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$2")}"); echo "FAIL  $1 — $2"; }

echo "== RNOS-19 Churn Health Gate =="

for f in \
  services/ptt-crm-api/src/ai-intelligence/ai-churn-health.service.ts \
  services/ptt-crm-api/src/ai-intelligence/churn-health.engine.ts \
  services/ptt-crm-api/src/ai-intelligence/customer-health-scores.repository.ts \
  services/ptt-crm-api/src/ai-intelligence/churn-health.engine.spec.ts \
  services/ptt-crm-api/src/ai-intelligence/ai-churn-health.service.spec.ts \
  services/ops-web/src/app/crm/health/page.tsx \
  services/ops-web/src/components/ai/CsHealthDashboardPanel.tsx \
  services/ops-web/src/components/ai/ClientHealthPanel.tsx \
  services/ops-web/e2e/churn-health-rnos19.spec.ts \
  ptt_jobs/handlers/churn_health_scan.py \
  scripts/ptt_churn_health_scan_cron.sh; do
  [[ -f "$ROOT/$f" ]] && log_ok "artifact-${f//\//-}" "Present" || log_fail "artifact-${f//\//-}" "Missing $f"
done

grep -q "score/churn" "$ROOT/services/ptt-crm-api/src/ai-intelligence/ai-intelligence.controller.ts" && log_ok api-score "POST score/churn" || log_fail api-score "Missing score endpoint"
grep -q "@Get('health')" "$ROOT/services/ptt-crm-api/src/ai-intelligence/ai-intelligence.controller.ts" && log_ok api-dashboard "GET health" || log_fail api-dashboard "Missing dashboard endpoint"
grep -q "health/client/:clientId" "$ROOT/services/ptt-crm-api/src/ai-intelligence/ai-intelligence.controller.ts" && log_ok api-client "GET health/client" || log_fail api-client "Missing client endpoint"
grep -q "ClientHealthPanel" "$ROOT/services/ops-web/src/app/agency/clients/[id]/AgencyClientDetailContent.tsx" && log_ok health-tab-ui "Health tab wired" || log_fail health-tab-ui "Missing Health tab"
grep -q "'health'" "$ROOT/services/ops-web/src/app/agency/clients/[id]/AgencyClientDetailContent.tsx" && log_ok health-tab "health tab id" || log_fail health-tab "Missing health tab"
grep -q "/crm/health" "$ROOT/services/ops-web/src/components/OpsNav.tsx" && log_ok nav "CS Health nav link" || log_fail nav "Missing nav link"
grep -q 'test:e2e:churn-health' "$ROOT/services/ops-web/package.json" && log_ok npm-script "e2e script present" || log_fail npm-script "Missing npm script"
grep -q "churn_health_scan" "$ROOT/ptt_worker/__main__.py" && log_ok worker "job type registered" || log_fail worker "Missing worker handler"
grep -q "fetchChurnHealthDashboard" "$ROOT/services/ops-web/src/lib/ai-api.ts" && log_ok ai-client "fetchChurnHealthDashboard" || log_fail ai-client "Missing ai-api client"

(cd "$ROOT/services/ptt-crm-api" && npm test -- churn-health.engine.spec.ts ai-churn-health.service.spec.ts --passWithNoTests 2>/dev/null) && log_ok api-unit "churn specs PASS" || log_fail api-unit "Unit tests failed"
(cd "$ROOT/services/ptt-crm-api" && npx tsc --noEmit) && log_ok api-typecheck "tsc OK" || log_fail api-typecheck "tsc failed"
(cd "$ROOT/services/ops-web" && npx tsc --noEmit) && log_ok ops-typecheck "tsc OK" || log_fail ops-typecheck "tsc failed"
python3 -m unittest tests.test_rnos19_churn_health -v 2>/dev/null && log_ok py-unit "test_rnos19_churn_health PASS" || log_fail py-unit "Python unit tests failed"
bash "$ROOT/scripts/playwright_ops_churn_health_e2e.sh" && log_ok playwright "E2E PASS" || log_fail playwright "E2E failed"

mkdir -p "$(dirname "$REPORT")"
python3 - <<PY
import json, os
report = {
  "gate": "RNOS-19",
  "use_case": "AI-UC-017",
  "pass": $pass,
  "fail": $fail,
  "results": [${results[@]}],
}
with open("$REPORT", "w", encoding="utf-8") as f:
    json.dump(report, f, indent=2)
PY

echo "== Summary: $pass pass, $fail fail =="
[[ "$fail" -eq 0 ]]
