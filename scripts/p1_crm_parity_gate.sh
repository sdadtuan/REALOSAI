#!/usr/bin/env bash
# P1 CRM parity — P0-2 Excel + §4 lead attribution gate
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
REPORT="${REPORT:-$ROOT/.local-dev/p1-crm-parity-gate-report.json}"
pass=0; fail=0; results=()
log_ok() { pass=$((pass+1)); results+=("{\"id\":\"$1\",\"status\":\"pass\",\"detail\":$(python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$2")}"); echo "PASS  $1 — $2"; }
log_fail() { fail=$((fail+1)); results+=("{\"id\":\"$1\",\"status\":\"fail\",\"detail\":$(python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$2")}"); echo "FAIL  $1 — $2"; }

echo "== P1 CRM Parity Gate (P0-2 + §4.3) =="

for f in \
  services/ptt-crm-api/src/leads/lead-attribution.service.ts \
  services/ptt-crm-api/src/leads/lead-attribution.util.ts \
  services/ops-web/src/components/crm/LeadAttributionChips.tsx \
  services/ops-web/src/components/crm/CrmLeadsImportExport.tsx \
  services/ops-web/e2e/lead-attribution-p1.spec.ts \
  services/ops-web/e2e/leads-excel-p02.spec.ts \
  scripts/p02_leads_excel_gate.sh; do
  [[ -f "$ROOT/$f" ]] && log_ok "artifact-${f//\//-}" "Present" || log_fail "artifact-${f//\//-}" "Missing $f"
done

grep -q ':id/attribution' "$ROOT/services/ptt-crm-api/src/crm-leads-legacy/crm-leads-legacy.controller.ts" && log_ok api-attribution "GET attribution endpoint" || log_fail api-attribution "Missing attribution endpoint"
grep -q 'export.xlsx' "$ROOT/services/ptt-crm-api/src/leads/leads.controller.ts" && log_ok p0-2-export "Excel export route" || log_fail p0-2-export "Missing export route"
grep -q 'LeadAttributionChips' "$ROOT/services/ops-web/src/app/crm/leads/[id]/page.tsx" && log_ok lead-detail-ui "Attribution chips wired" || log_fail lead-detail-ui "Missing chips on lead detail"
grep -q 'CAMPAIGN_CPL' "$ROOT/services/ptt-crm-api/src/ai-intelligence/ai-summarize.service.ts" && log_ok ai-brief "Summarize includes campaign/CPL" || log_fail ai-brief "Missing CPL in brief context"
grep -q 'cpl_over_target' "$ROOT/services/ptt-crm-api/src/ai-intelligence/lead-score.engine.ts" && log_ok ai-score "Score explain CPL factor" || log_fail ai-score "Missing CPL score factor"
grep -q 'test:e2e:lead-attribution' "$ROOT/services/ops-web/package.json" && log_ok npm-attribution "e2e script present" || log_fail npm-attribution "Missing npm script"

(cd "$ROOT/services/ptt-crm-api" && npm test -- lead-attribution.util.spec.ts lead-score.engine.spec.ts --passWithNoTests 2>/dev/null) && log_ok api-unit "unit tests PASS" || log_fail api-unit "Unit tests failed"
(cd "$ROOT/services/ptt-crm-api" && npx tsc --noEmit) && log_ok api-typecheck "tsc OK" || log_fail api-typecheck "tsc failed"
(cd "$ROOT/services/ops-web" && npx tsc --noEmit) && log_ok ops-typecheck "tsc OK" || log_fail ops-typecheck "tsc failed"
bash "$ROOT/scripts/playwright_ops_lead_attribution_e2e.sh" && log_ok playwright-attribution "attribution E2E PASS" || log_fail playwright-attribution "attribution E2E failed"
bash "$ROOT/scripts/playwright_ops_leads_excel_e2e.sh" && log_ok playwright-excel "P0-2 Excel E2E PASS" || log_fail playwright-excel "Excel E2E failed"

mkdir -p "$(dirname "$REPORT")"
TMP="$(mktemp)"; printf '%s\n' "${results[@]}" > "$TMP"
python3 - <<PY
import json, datetime
from pathlib import Path
checks=[json.loads(l) for l in Path("$TMP").read_text().splitlines() if l.strip()]
report={"generated_at":datetime.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),"gate":"P1-CRM-PARITY","summary":{"pass":$pass,"fail":$fail},"checks":checks}
Path("$REPORT").write_text(json.dumps(report,indent=2,ensure_ascii=False)+"\\n")
print(json.dumps(report,indent=2,ensure_ascii=False))
PY
rm -f "$TMP"
echo "PASS=$pass FAIL=$fail"; [[ "$fail" -eq 0 ]]
