#!/usr/bin/env bash
# RNOS-26 — Lead Routing Agent v1 gate
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
REPORT="${REPORT:-$ROOT/.local-dev/rnos26-lead-routing-gate-report.json}"
pass=0; fail=0; results=()
log_ok() { pass=$((pass+1)); results+=("{\"id\":\"$1\",\"status\":\"pass\",\"detail\":$(python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$2")}"); echo "PASS  $1 — $2"; }
log_fail() { fail=$((fail+1)); results+=("{\"id\":\"$1\",\"status\":\"fail\",\"detail\":$(python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$2")}"); echo "FAIL  $1 — $2"; }

echo "== RNOS-26 Lead Routing Gate =="

for f in \
  services/ptt-crm-api/src/ai-intelligence/lead-route.engine.ts \
  services/ptt-crm-api/src/ai-intelligence/ai-lead-route.service.ts \
  services/ptt-crm-api/src/ai-intelligence/lead-route-context.repository.ts \
  services/ptt-crm-api/src/ai-intelligence/lead-route.engine.spec.ts \
  services/ptt-crm-api/src/ai-intelligence/ai-lead-route.service.spec.ts \
  services/ops-web/src/components/ai/LeadRouteRepSection.tsx \
  services/ops-web/src/components/ai/RouteRepCard.tsx \
  services/ops-web/e2e/lead-routing-rnos26.spec.ts \
  scripts/playwright_ops_lead_routing_e2e.sh; do
  [[ -f "$ROOT/$f" ]] && log_ok "artifact-${f//\//-}" "Present" || log_fail "artifact-${f//\//-}" "Missing $f"
done

grep -q "route/lead" "$ROOT/services/ptt-crm-api/src/ai-intelligence/ai-intelligence.controller.ts" && log_ok api-endpoint "POST route/lead" || log_fail api-endpoint "Missing route endpoint"
grep -q "ROUTE_REP" "$ROOT/services/ptt-crm-api/src/ai-intelligence/ai-audit.constants.ts" && log_ok audit "ROUTE_REP use case" || log_fail audit "Missing audit constant"
grep -q "postAiRouteLead" "$ROOT/services/ops-web/src/lib/ai-api.ts" && log_ok ai-client "postAiRouteLead" || log_fail ai-client "Missing ai-api client"
grep -q "LeadRouteRepSection" "$ROOT/services/ops-web/src/components/ai/LeadCopilotPanel.tsx" && log_ok copilot-ui "Routing section wired" || log_fail copilot-ui "Missing copilot routing UI"
grep -q "route_rep" "$ROOT/services/ptt-crm-api/src/ai-intelligence/ai-lead-route.service.ts" && log_ok rec-type "route_rep recommendation" || log_fail rec-type "Missing route_rep type"
grep -q "PTT_AI_LEAD_ROUTING_ENABLED" "$ROOT/deploy/env.staging-phase3.example" && log_ok env-flag "Staging env flag documented" || log_fail env-flag "Missing env flag"

(cd "$ROOT/services/ptt-crm-api" && npm test -- lead-route ai-lead-route ai-recommendation.service.spec --passWithNoTests 2>/dev/null) && log_ok api-unit "lead routing specs PASS" || log_fail api-unit "Unit tests failed"
(cd "$ROOT/services/ptt-crm-api" && npx tsc --noEmit) && log_ok api-typecheck "tsc OK" || log_fail api-typecheck "tsc failed"
(cd "$ROOT/services/ops-web" && npx tsc --noEmit) && log_ok ops-typecheck "tsc OK" || log_fail ops-typecheck "tsc failed"
python3 -m unittest tests.test_rnos26_lead_routing -v 2>/dev/null && log_ok py-unit "test_rnos26_lead_routing PASS" || log_fail py-unit "Python unit tests failed"
bash "$ROOT/scripts/playwright_ops_lead_routing_e2e.sh" && log_ok playwright "E2E PASS" || log_fail playwright "E2E failed"

mkdir -p "$(dirname "$REPORT")"
results_csv=$(IFS=','; echo "${results[*]}")
python3 - <<PY
import json, os
report = {
  "gate": "RNOS-26",
  "use_case": "Lead Routing Agent v1",
  "pass": $pass,
  "fail": $fail,
  "results": [$results_csv],
}
with open("$REPORT", "w", encoding="utf-8") as f:
    json.dump(report, f, indent=2, ensure_ascii=False)
PY

echo "== Summary: $pass pass, $fail fail =="
[[ "$fail" -eq 0 ]]
