#!/usr/bin/env bash
# RNOS-20 / AI-UC-014 — Renewal agent workflow gate
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
REPORT="${REPORT:-$ROOT/.local-dev/rnos20-renewal-gate-report.json}"
pass=0; fail=0; results=()
log_ok() { pass=$((pass+1)); results+=("{\"id\":\"$1\",\"status\":\"pass\",\"detail\":$(python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$2")}"); echo "PASS  $1 — $2"; }
log_fail() { fail=$((fail+1)); results+=("{\"id\":\"$1\",\"status\":\"fail\",\"detail\":$(python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$2")}"); echo "FAIL  $1 — $2"; }

echo "== RNOS-20 Renewal Gate =="

for f in \
  services/ptt-crm-api/src/ai-intelligence/renewal-agent.service.ts \
  services/ptt-crm-api/src/ai-intelligence/renewal.engine.ts \
  services/ptt-crm-api/src/ai-intelligence/renewal-opportunities.repository.ts \
  services/ptt-crm-api/src/ai-intelligence/renewal.engine.spec.ts \
  services/ptt-crm-api/src/ai-intelligence/renewal-agent.service.spec.ts \
  services/ops-web/src/components/ai/RenewalAgentPanel.tsx \
  services/ops-web/e2e/renewal-rnos20.spec.ts \
  ptt_jobs/handlers/renewal_scan.py \
  scripts/ptt_renewal_scan_cron.sh; do
  [[ -f "$ROOT/$f" ]] && log_ok "artifact-${f//\//-}" "Present" || log_fail "artifact-${f//\//-}" "Missing $f"
done

grep -q "renewal/scan" "$ROOT/services/ptt-crm-api/src/ai-intelligence/ai-intelligence.controller.ts" && log_ok api-scan "POST renewal/scan" || log_fail api-scan "Missing scan endpoint"
grep -q "@Get('renewal')" "$ROOT/services/ptt-crm-api/src/ai-intelligence/ai-intelligence.controller.ts" && log_ok api-list "GET renewal" || log_fail api-list "Missing list endpoint"
grep -q "renewal/:id/draft" "$ROOT/services/ptt-crm-api/src/ai-intelligence/ai-intelligence.controller.ts" && log_ok api-draft "POST draft" || log_fail api-draft "Missing draft endpoint"
grep -q "RenewalAgentPanel" "$ROOT/services/ops-web/src/app/agency/clients/[id]/AgencyClientDetailContent.tsx" && log_ok retain-ui "Retain tab wired" || log_fail retain-ui "Missing Retain tab"
grep -q "'retain'" "$ROOT/services/ops-web/src/app/agency/clients/[id]/AgencyClientDetailContent.tsx" && log_ok retain-tab "retain tab id" || log_fail retain-tab "Missing retain tab"
grep -q 'test:e2e:renewal' "$ROOT/services/ops-web/package.json" && log_ok npm-script "e2e script present" || log_fail npm-script "Missing npm script"
grep -q "renewal_scan" "$ROOT/ptt_worker/__main__.py" && log_ok worker "job type registered" || log_fail worker "Missing worker handler"
grep -q "fetchRenewalOpportunities" "$ROOT/services/ops-web/src/lib/ai-api.ts" && log_ok ai-client "fetchRenewalOpportunities" || log_fail ai-client "Missing ai-api client"

(cd "$ROOT/services/ptt-crm-api" && npm test -- renewal.engine.spec.ts renewal-agent.service.spec.ts --passWithNoTests 2>/dev/null) && log_ok api-unit "renewal specs PASS" || log_fail api-unit "Unit tests failed"
(cd "$ROOT/services/ptt-crm-api" && npx tsc --noEmit) && log_ok api-typecheck "tsc OK" || log_fail api-typecheck "tsc failed"
(cd "$ROOT/services/ops-web" && npx tsc --noEmit) && log_ok ops-typecheck "tsc OK" || log_fail ops-typecheck "tsc failed"
python3 -m unittest tests.test_rnos20_renewal -v 2>/dev/null && log_ok py-unit "test_rnos20_renewal PASS" || log_fail py-unit "Python unit tests failed"
bash "$ROOT/scripts/playwright_ops_renewal_e2e.sh" && log_ok playwright "E2E PASS" || log_fail playwright "E2E failed"

mkdir -p "$(dirname "$REPORT")"
TMP="$(mktemp)"; printf '%s\n' "${results[@]}" > "$TMP"
python3 - <<PY
import json, datetime
from pathlib import Path
checks=[json.loads(l) for l in Path("$TMP").read_text().splitlines() if l.strip()]
report={"generated_at":datetime.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),"rnos":"RNOS-20","summary":{"pass":$pass,"fail":$fail},"checks":checks}
Path("$REPORT").write_text(json.dumps(report,indent=2,ensure_ascii=False)+"\\n")
print(json.dumps(report,indent=2,ensure_ascii=False))
PY
rm -f "$TMP"
echo "PASS=$pass FAIL=$fail"; [[ "$fail" -eq 0 ]]
