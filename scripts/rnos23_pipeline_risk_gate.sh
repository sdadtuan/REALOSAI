#!/usr/bin/env bash
# RNOS-23 / AI-UC-015 — Pipeline risk daily scan gate
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
REPORT="${REPORT:-$ROOT/.local-dev/rnos23-pipeline-risk-gate-report.json}"
pass=0; fail=0; results=()
log_ok() { pass=$((pass+1)); results+=("{\"id\":\"$1\",\"status\":\"pass\",\"detail\":$(python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$2")}"); echo "PASS  $1 — $2"; }
log_fail() { fail=$((fail+1)); results+=("{\"id\":\"$1\",\"status\":\"fail\",\"detail\":$(python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$2")}"); echo "FAIL  $1 — $2"; }

echo "== RNOS-23 Pipeline Risk Gate =="

for f in \
  services/ptt-crm-api/src/ai-intelligence/pipeline-risk.service.ts \
  services/ptt-crm-api/src/ai-intelligence/pipeline-risk.types.ts \
  services/ptt-crm-api/src/ai-intelligence/pipeline-risk.service.spec.ts \
  services/ops-web/src/components/ai/PipelineRiskPanel.tsx \
  services/ops-web/e2e/pipeline-risk-rnos23.spec.ts \
  ptt_jobs/handlers/pipeline_risk_scan.py \
  scripts/ptt_pipeline_risk_scan_cron.sh; do
  [[ -f "$ROOT/$f" ]] && log_ok "artifact-${f//\//-}" "Present" || log_fail "artifact-${f//\//-}" "Missing $f"
done

grep -q "pipeline-risk/scan" "$ROOT/services/ptt-crm-api/src/ai-intelligence/ai-intelligence.controller.ts" && log_ok api-scan "POST pipeline-risk/scan" || log_fail api-scan "Missing scan endpoint"
grep -q "pipeline-risk/at-risk" "$ROOT/services/ptt-crm-api/src/ai-intelligence/ai-intelligence.controller.ts" && log_ok api-at-risk "GET pipeline-risk/at-risk" || log_fail api-at-risk "Missing at-risk endpoint"
grep -q "PipelineRiskService" "$ROOT/services/ptt-crm-api/src/ai-intelligence/ai-intelligence.module.ts" && log_ok module "PipelineRiskService registered" || log_fail module "Missing module registration"
grep -q "fetchPipelineRiskAtRisk" "$ROOT/services/ops-web/src/lib/ai-api.ts" && log_ok ai-client "fetchPipelineRiskAtRisk" || log_fail ai-client "Missing ai-api client"
grep -q "PipelineRiskPanel" "$ROOT/services/ops-web/src/app/crm/ai/insights/page.tsx" && log_ok insights-ui "Panel wired on insights" || log_fail insights-ui "Missing insights panel"
grep -q "initialDealId" "$ROOT/services/ops-web/src/app/crm/sales/page.tsx" && log_ok sales-drill "deal_id drill-through" || log_fail sales-drill "Missing deal_id param"
grep -q 'test:e2e:pipeline-risk' "$ROOT/services/ops-web/package.json" && log_ok npm-script "e2e script present" || log_fail npm-script "Missing npm script"
grep -q "pipeline_risk_scan" "$ROOT/ptt_worker/__main__.py" && log_ok worker "job type registered" || log_fail worker "Missing worker handler"

(cd "$ROOT/services/ptt-crm-api" && npm test -- pipeline-risk.service.spec.ts --passWithNoTests 2>/dev/null) && log_ok api-unit "pipeline-risk.service.spec PASS" || log_fail api-unit "Unit tests failed"
(cd "$ROOT/services/ptt-crm-api" && npx tsc --noEmit) && log_ok api-typecheck "tsc OK" || log_fail api-typecheck "tsc failed"
(cd "$ROOT/services/ops-web" && npx tsc --noEmit) && log_ok ops-typecheck "tsc OK" || log_fail ops-typecheck "tsc failed"
python3 -m unittest tests.test_rnos23_pipeline_risk -v 2>/dev/null && log_ok py-unit "test_rnos23_pipeline_risk PASS" || log_fail py-unit "Python unit tests failed"
bash "$ROOT/scripts/playwright_ops_pipeline_risk_e2e.sh" && log_ok playwright "E2E PASS" || log_fail playwright "E2E failed"

mkdir -p "$(dirname "$REPORT")"
TMP="$(mktemp)"; printf '%s\n' "${results[@]}" > "$TMP"
python3 - <<PY
import json, datetime
from pathlib import Path
checks=[json.loads(l) for l in Path("$TMP").read_text().splitlines() if l.strip()]
report={"generated_at":datetime.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),"rnos":"RNOS-23","summary":{"pass":$pass,"fail":$fail},"checks":checks}
Path("$REPORT").write_text(json.dumps(report,indent=2,ensure_ascii=False)+"\\n")
print(json.dumps(report,indent=2,ensure_ascii=False))
PY
rm -f "$TMP"
echo "PASS=$pass FAIL=$fail"; [[ "$fail" -eq 0 ]]
