#!/usr/bin/env bash
# RNOS-27 — Upsell Agent gate
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
REPORT="${REPORT:-$ROOT/.local-dev/rnos27-upsell-gate-report.json}"
pass=0; fail=0; results=()
log_ok() { pass=$((pass+1)); results+=("{\"id\":\"$1\",\"status\":\"pass\",\"detail\":$(python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$2")}"); echo "PASS  $1 — $2"; }
log_fail() { fail=$((fail+1)); results+=("{\"id\":\"$1\",\"status\":\"fail\",\"detail\":$(python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$2")}"); echo "FAIL  $1 — $2"; }

echo "== RNOS-27 Upsell Agent Gate =="

for f in \
  services/ptt-crm-api/src/ai-intelligence/upsell.engine.ts \
  services/ptt-crm-api/src/ai-intelligence/upsell-agent.service.ts \
  services/ptt-crm-api/src/ai-intelligence/upsell-context.repository.ts \
  services/ptt-crm-api/src/ai-intelligence/upsell.engine.spec.ts \
  services/ptt-crm-api/src/ai-intelligence/upsell-agent.service.spec.ts \
  services/ops-web/src/components/ai/UpsellAgentPanel.tsx \
  services/ops-web/e2e/upsell-rnos27.spec.ts \
  scripts/playwright_ops_upsell_e2e.sh; do
  [[ -f "$ROOT/$f" ]] && log_ok "artifact-${f//\//-}" "Present" || log_fail "artifact-${f//\//-}" "Missing $f"
done

grep -q "upsell/suggest" "$ROOT/services/ptt-crm-api/src/ai-intelligence/ai-intelligence.controller.ts" && log_ok api-endpoint "POST upsell/suggest" || log_fail api-endpoint "Missing upsell endpoints"
grep -q "UPSELL_SUGGEST" "$ROOT/services/ptt-crm-api/src/ai-intelligence/ai-audit.constants.ts" && log_ok audit "UPSELL_SUGGEST use case" || log_fail audit "Missing audit constant"
grep -q "fetchUpsellSuggestions" "$ROOT/services/ops-web/src/lib/ai-api.ts" && log_ok ai-client "fetchUpsellSuggestions" || log_fail ai-client "Missing ai-api client"
grep -q "UpsellAgentPanel" "$ROOT/services/ops-web/src/app/agency/clients/[id]/AgencyClientDetailContent.tsx" && log_ok retain-ui "Upsell panel wired" || log_fail retain-ui "Missing retain tab wiring"
grep -q "recommendation_type === UPSELL_TYPE" "$ROOT/services/ptt-crm-api/src/ai-intelligence/upsell-agent.service.ts" && log_ok rec-type "upsell recommendation" || log_fail rec-type "Missing upsell type"
grep -q "PTT_AI_UPSELL_ENABLED" "$ROOT/deploy/env.staging-phase3.example" && log_ok env-flag "Staging env flag documented" || log_fail env-flag "Missing env flag"
grep -q "computeUpsellSuggestions" "$ROOT/services/ptt-crm-api/src/ai-intelligence/upsell.engine.ts" && log_ok engine "Rules engine present" || log_fail engine "Missing computeUpsellSuggestions"

(cd "$ROOT/services/ptt-crm-api" && npm test -- upsell --passWithNoTests 2>/dev/null) && log_ok api-unit "upsell specs PASS" || log_fail api-unit "Unit tests failed"
(cd "$ROOT/services/ptt-crm-api" && npx tsc --noEmit) && log_ok api-typecheck "tsc OK" || log_fail api-typecheck "tsc failed"
(cd "$ROOT/services/ops-web" && npx tsc --noEmit) && log_ok ops-typecheck "tsc OK" || log_fail ops-typecheck "tsc failed"
python3 -m unittest tests.test_rnos27_upsell -v 2>/dev/null && log_ok py-unit "test_rnos27_upsell PASS" || log_fail py-unit "Python unit tests failed"
bash "$ROOT/scripts/playwright_ops_upsell_e2e.sh" && log_ok playwright "E2E PASS" || log_fail playwright "E2E failed"

mkdir -p "$(dirname "$REPORT")"
results_csv=$(IFS=','; echo "${results[*]}")
python3 - <<PY
import json, os
report = {
  "gate": "RNOS-27",
  "use_case": "Upsell Agent",
  "pass": $pass,
  "fail": $fail,
  "results": [$results_csv],
}
with open("$REPORT", "w", encoding="utf-8") as f:
    json.dump(report, f, indent=2, ensure_ascii=False)
PY

echo "== Summary: $pass pass, $fail fail =="
[[ "$fail" -eq 0 ]]
