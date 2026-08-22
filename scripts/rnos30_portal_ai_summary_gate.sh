#!/usr/bin/env bash
# RNOS-30 / UI-R3-07 — Portal AI report summary gate
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
REPORT="${REPORT:-$ROOT/.local-dev/rnos30-portal-ai-summary-gate-report.json}"
pass=0; fail=0; results=()
log_ok() { pass=$((pass+1)); results+=("{\"id\":\"$1\",\"status\":\"pass\",\"detail\":$(python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$2")}"); echo "PASS  $1 — $2"; }
log_fail() { fail=$((fail+1)); results+=("{\"id\":\"$1\",\"status\":\"fail\",\"detail\":$(python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$2")}"); echo "FAIL  $1 — $2"; }

echo "== RNOS-30 Portal AI Summary Gate =="

for f in \
  services/ptt-crm-api/src/portal-ai/portal-ai.module.ts \
  services/ptt-crm-api/src/portal-ai/portal-ai-report.controller.ts \
  services/ptt-crm-api/src/portal-ai/portal-ai-report.service.ts \
  services/ptt-crm-api/src/portal-ai/portal-report-summary.engine.ts \
  services/ptt-crm-api/src/portal-ai/portal-report-summary.engine.spec.ts \
  services/ptt-crm-api/src/portal-ai/portal-ai-report.service.spec.ts \
  services/portal-web/src/components/PortalAiReportSummary.tsx \
  services/portal-web/e2e/portal-ai-summary-rnos30.spec.ts \
  scripts/playwright_portal_ai_summary_e2e.sh; do
  [[ -f "$ROOT/$f" ]] && log_ok "artifact-${f//\//-}" "Present" || log_fail "artifact-${f//\//-}" "Missing $f"
done

grep -q "report-summary" "$ROOT/services/ptt-crm-api/src/portal-ai/portal-ai-report.controller.ts" && log_ok api-endpoint "GET report-summary" || log_fail api-endpoint "Missing portal AI endpoint"
grep -q "fetchPortalAiReportSummary" "$ROOT/services/portal-web/src/lib/api.ts" && log_ok portal-api "fetchPortalAiReportSummary" || log_fail portal-api "Missing portal API client"
grep -q "PortalAiReportSummary" "$ROOT/services/portal-web/src/app/dashboard/page.tsx" && log_ok dashboard "Dashboard widget wired" || log_fail dashboard "Missing dashboard widget"
grep -q "portal-ai-summary" "$ROOT/services/portal-web/src/app/globals.css" && log_ok css "Portal AI summary CSS" || log_fail css "Missing CSS"
grep -q "PORTAL_REPORT_SUMMARY" "$ROOT/services/ptt-crm-api/src/ai-intelligence/ai-audit.constants.ts" && log_ok audit "PORTAL_REPORT_SUMMARY use case" || log_fail audit "Missing audit constant"
grep -q "PTT_PORTAL_AI_SUMMARY_ENABLED" "$ROOT/deploy/env.staging-phase3.example" && log_ok env-flag "Staging env flag documented" || log_fail env-flag "Missing env flag in staging example"

(cd "$ROOT/services/ptt-crm-api" && npm test -- portal-report-summary portal-ai-report.service.spec --passWithNoTests 2>/dev/null) && log_ok api-unit "portal summary specs PASS" || log_fail api-unit "Unit tests failed"
(cd "$ROOT/services/ptt-crm-api" && npx tsc --noEmit) && log_ok api-typecheck "tsc OK" || log_fail api-typecheck "tsc failed"
(cd "$ROOT/services/portal-web" && npx tsc --noEmit) && log_ok portal-typecheck "tsc OK" || log_fail portal-typecheck "tsc failed"
python3 -m unittest tests.test_rnos30_portal_ai_summary -v 2>/dev/null && log_ok py-unit "test_rnos30_portal_ai_summary PASS" || log_fail py-unit "Python unit tests failed"
bash "$ROOT/scripts/playwright_portal_ai_summary_e2e.sh" && log_ok playwright "E2E PASS" || log_fail playwright "E2E failed"

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
  "rnos": "RNOS-30",
  "ui": "UI-R3-07",
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