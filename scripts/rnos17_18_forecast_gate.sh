#!/usr/bin/env bash
# RNOS-17/18 / AI-UC-013 — Revenue forecast snapshot + dashboard gate
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
REPORT="${REPORT:-$ROOT/.local-dev/rnos17-18-forecast-gate-report.json}"
pass=0; fail=0; results=()
log_ok() { pass=$((pass+1)); results+=("{\"id\":\"$1\",\"status\":\"pass\",\"detail\":$(python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$2")}"); echo "PASS  $1 — $2"; }
log_fail() { fail=$((fail+1)); results+=("{\"id\":\"$1\",\"status\":\"fail\",\"detail\":$(python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$2")}"); echo "FAIL  $1 — $2"; }

echo "== RNOS-17/18 Forecast Gate =="

for f in \
  services/ptt-crm-api/src/ai-intelligence/ai-forecast.service.ts \
  services/ptt-crm-api/src/ai-intelligence/forecast.engine.ts \
  services/ptt-crm-api/src/ai-intelligence/revenue-forecast.repository.ts \
  services/ptt-crm-api/src/ai-intelligence/forecast.engine.spec.ts \
  services/ptt-crm-api/src/ai-intelligence/ai-forecast.service.spec.ts \
  services/ops-web/src/app/crm/forecast/page.tsx \
  services/ops-web/src/components/ai/ForecastCommitPanel.tsx \
  services/ops-web/e2e/forecast-rnos17-18.spec.ts \
  ptt_jobs/handlers/forecast_snapshot.py \
  scripts/ptt_forecast_snapshot_cron.sh; do
  [[ -f "$ROOT/$f" ]] && log_ok "artifact-${f//\//-}" "Present" || log_fail "artifact-${f//\//-}" "Missing $f"
done

grep -q "@Post('forecast')" "$ROOT/services/ptt-crm-api/src/ai-intelligence/ai-intelligence.controller.ts" && log_ok api-snapshot "POST forecast" || log_fail api-snapshot "Missing POST forecast"
grep -q "forecast/current" "$ROOT/services/ptt-crm-api/src/ai-intelligence/ai-intelligence.controller.ts" && log_ok api-dashboard "GET forecast/current" || log_fail api-dashboard "Missing dashboard endpoint"
grep -q "forecast/commit" "$ROOT/services/ptt-crm-api/src/ai-intelligence/ai-intelligence.controller.ts" && log_ok api-commit "PATCH forecast/commit" || log_fail api-commit "Missing commit endpoint"
grep -q "AiForecastService" "$ROOT/services/ptt-crm-api/src/ai-intelligence/ai-intelligence.module.ts" && log_ok module "AiForecastService registered" || log_fail module "Missing module registration"
grep -q "fetchForecastDashboard" "$ROOT/services/ops-web/src/lib/ai-api.ts" && log_ok ai-client "fetchForecastDashboard" || log_fail ai-client "Missing ai-api client"
grep -q "/crm/forecast" "$ROOT/services/ops-web/src/components/OpsNav.tsx" && log_ok nav "Forecast nav link" || log_fail nav "Missing nav link"
grep -q 'test:e2e:forecast' "$ROOT/services/ops-web/package.json" && log_ok npm-script "e2e script present" || log_fail npm-script "Missing npm script"
grep -q "forecast_snapshot" "$ROOT/ptt_worker/__main__.py" && log_ok worker "job type registered" || log_fail worker "Missing worker handler"

(cd "$ROOT/services/ptt-crm-api" && npm test -- forecast.engine.spec.ts ai-forecast.service.spec.ts --passWithNoTests 2>/dev/null) && log_ok api-unit "forecast specs PASS" || log_fail api-unit "Unit tests failed"
(cd "$ROOT/services/ptt-crm-api" && npx tsc --noEmit) && log_ok api-typecheck "tsc OK" || log_fail api-typecheck "tsc failed"
(cd "$ROOT/services/ops-web" && npx tsc --noEmit) && log_ok ops-typecheck "tsc OK" || log_fail ops-typecheck "tsc failed"
python3 -m unittest tests.test_rnos17_18_forecast -v 2>/dev/null && log_ok py-unit "test_rnos17_18_forecast PASS" || log_fail py-unit "Python unit tests failed"
bash "$ROOT/scripts/playwright_ops_forecast_e2e.sh" && log_ok playwright "E2E PASS" || log_fail playwright "E2E failed"

mkdir -p "$(dirname "$REPORT")"
TMP="$(mktemp)"; printf '%s\n' "${results[@]}" > "$TMP"
python3 - <<PY
import json, datetime
from pathlib import Path
checks=[json.loads(l) for l in Path("$TMP").read_text().splitlines() if l.strip()]
report={"generated_at":datetime.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),"rnos":"RNOS-17-18","summary":{"pass":$pass,"fail":$fail},"checks":checks}
Path("$REPORT").write_text(json.dumps(report,indent=2,ensure_ascii=False)+"\\n")
print(json.dumps(report,indent=2,ensure_ascii=False))
PY
rm -f "$TMP"
echo "PASS=$pass FAIL=$fail"; [[ "$fail" -eq 0 ]]
