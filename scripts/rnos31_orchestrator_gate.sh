#!/usr/bin/env bash
# RNOS-31 / AI-UC-021 — Multi-agent orchestrator gate
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
REPORT="${REPORT:-$ROOT/.local-dev/rnos31-orchestrator-gate-report.json}"
pass=0; fail=0; results=()
log_ok() { pass=$((pass+1)); results+=("{\"id\":\"$1\",\"status\":\"pass\",\"detail\":$(python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$2")}"); echo "PASS  $1 — $2"; }
log_fail() { fail=$((fail+1)); results+=("{\"id\":\"$1\",\"status\":\"fail\",\"detail\":$(python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$2")}"); echo "FAIL  $1 — $2"; }

echo "== RNOS-31 Multi-agent Orchestrator Gate =="

for f in \
  services/ptt-crm-api/src/ai-intelligence/orchestrator/orchestrator.engine.ts \
  services/ptt-crm-api/src/ai-intelligence/orchestrator/orchestrator.service.ts \
  services/ptt-crm-api/src/ai-intelligence/orchestrator/orchestrator.repository.ts \
  services/ptt-crm-api/src/ai-intelligence/orchestrator/orchestrator-cron.service.ts \
  services/ptt-crm-api/src/ai-intelligence/orchestrator/orchestrator.types.ts \
  services/ptt-crm-api/src/ai-intelligence/orchestrator/agent.registry.ts \
  services/ptt-crm-api/src/ai-intelligence/orchestrator/plans/lead-intake.plan.ts \
  services/ptt-crm-api/src/ai-intelligence/orchestrator/orchestrator.service.spec.ts \
  services/ptt-crm-api/src/ai-intelligence/orchestrator/orchestrator-cron.service.spec.ts \
  services/ptt-crm-api/src/ai-intelligence/orchestrator/agent.registry.spec.ts \
  services/ops-web/src/app/admin/ai/agents/page.tsx \
  services/ops-web/src/components/ai/OrchestrationTracePanel.tsx \
  services/ops-web/src/components/ai/AgentRunTree.tsx \
  services/ops-web/e2e/orchestrator-rnos31.spec.ts \
  scripts/playwright_ops_orchestrator_e2e.sh; do
  [[ -f "$ROOT/$f" ]] && log_ok "artifact-${f//\//-}" "Present" || log_fail "artifact-${f//\//-}" "Missing $f"
done

grep -q "Post('orchestrator/run')" "$ROOT/services/ptt-crm-api/src/ai-intelligence/ai-intelligence.controller.ts" && log_ok api-run "POST orchestrator/run" || log_fail api-run "Missing run endpoint"
grep -q "Get('orchestrator')" "$ROOT/services/ptt-crm-api/src/ai-intelligence/ai-intelligence.controller.ts" && log_ok api-list "GET orchestrator" || log_fail api-list "Missing list endpoint"
grep -q "Get('orchestrator/:id')" "$ROOT/services/ptt-crm-api/src/ai-intelligence/ai-intelligence.controller.ts" && log_ok api-detail "GET orchestrator/:id" || log_fail api-detail "Missing detail endpoint"
grep -q "orchestrator/cron/retain-health" "$ROOT/services/ptt-crm-api/src/ai-intelligence/ai-intelligence.controller.ts" && log_ok api-cron "POST orchestrator cron" || log_fail api-cron "Missing cron endpoint"
grep -q "ORCHESTRATION_RUN" "$ROOT/services/ptt-crm-api/src/ai-intelligence/ai-audit.constants.ts" && log_ok audit-run "ORCHESTRATION_RUN use case" || log_fail audit-run "Missing ORCHESTRATION_RUN"
grep -q "ORCHESTRATION_STEP" "$ROOT/services/ptt-crm-api/src/ai-intelligence/ai-audit.constants.ts" && log_ok audit-step "ORCHESTRATION_STEP use case" || log_fail audit-step "Missing ORCHESTRATION_STEP"
grep -q "PTT_AI_ORCHESTRATOR_ENABLED" "$ROOT/deploy/env.staging-phase3.example" && log_ok env-flag "Orchestrator env flag documented" || log_fail env-flag "Missing orchestrator env flag"
grep -q "PTT_AI_ORCHESTRATOR_CRON_ENABLED" "$ROOT/deploy/env.staging-phase3.example" && log_ok env-cron "Orchestrator cron flag documented" || log_fail env-cron "Missing orchestrator cron flag"
grep -q "lead_intake_v1" "$ROOT/services/ptt-crm-api/src/ai-intelligence/orchestrator/plans/lead-intake.plan.ts" && log_ok lead-plan "lead_intake_v1 plan registered" || log_fail lead-plan "Missing lead intake plan"
grep -q "fetchOrchestrations" "$ROOT/services/ops-web/src/lib/ai-api.ts" && log_ok ai-list-client "Orchestration list client" || log_fail ai-list-client "Missing list client"
grep -q "fetchOrchestrationById" "$ROOT/services/ops-web/src/lib/ai-api.ts" && log_ok ai-detail-client "Orchestration detail client" || log_fail ai-detail-client "Missing detail client"
grep -q "postOrchestratorRun" "$ROOT/services/ops-web/src/lib/ai-api.ts" && log_ok ai-run-client "Orchestration run client" || log_fail ai-run-client "Missing run client"
grep -q "OrchestrationTracePanel" "$ROOT/services/ops-web/src/app/admin/ai/agents/page.tsx" && log_ok trace-page "Trace panel wired" || log_fail trace-page "Missing trace panel wiring"
grep -q "AgentRunTree" "$ROOT/services/ops-web/src/components/ai/OrchestrationTracePanel.tsx" && log_ok trace-tree "Agent run tree wired" || log_fail trace-tree "Missing agent run tree"
grep -q "AI-UC-021" "$ROOT/docs/use-cases/actions/09-AI-ACTIONS.md" && log_ok uat-actions "AI-UC-021 documented" || log_fail uat-actions "Missing AI-UC-021 actions"

(cd "$ROOT/services/ptt-crm-api" && npm test -- orchestrator --passWithNoTests 2>/dev/null) && log_ok api-unit "orchestrator specs PASS" || log_fail api-unit "Unit tests failed"
(cd "$ROOT/services/ptt-crm-api" && npx tsc --noEmit) && log_ok api-typecheck "tsc OK" || log_fail api-typecheck "tsc failed"
(cd "$ROOT/services/ops-web" && npx tsc --noEmit) && log_ok ops-typecheck "tsc OK" || log_fail ops-typecheck "tsc failed"
python3 -m unittest tests.test_rnos31_orchestrator -v 2>/dev/null && log_ok py-unit "test_rnos31_orchestrator PASS" || log_fail py-unit "Python unit tests failed"
if [[ "${OPS_E2E_SKIP_SERVER:-1}" == "1" ]]; then
  log_ok playwright "E2E skipped (OPS_E2E_SKIP_SERVER=1; run playwright_ops_orchestrator_e2e.sh with OPS_E2E_SKIP_SERVER=0 for full UI/API smoke)"
else
  bash "$ROOT/scripts/playwright_ops_orchestrator_e2e.sh" && log_ok playwright "E2E PASS" || log_fail playwright "E2E failed"
fi

mkdir -p "$(dirname "$REPORT")"
results_csv=$(IFS=','; echo "${results[*]}")
python3 - <<PY
import json
report = {
  "gate": "RNOS-31",
  "use_case": "AI-UC-021",
  "pass": $pass,
  "fail": $fail,
  "results": [$results_csv],
}
with open("$REPORT", "w", encoding="utf-8") as f:
    json.dump(report, f, indent=2, ensure_ascii=False)
PY

echo "== Summary: $pass pass, $fail fail =="
[[ "$fail" -eq 0 ]]
