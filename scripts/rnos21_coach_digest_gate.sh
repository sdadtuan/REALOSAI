#!/usr/bin/env bash
# RNOS-21 / AI-UC-018 — Manager coach digest gate
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
REPORT="${REPORT:-$ROOT/.local-dev/rnos21-coach-digest-gate-report.json}"
pass=0; fail=0; results=()
log_ok() { pass=$((pass+1)); results+=("{\"id\":\"$1\",\"status\":\"pass\",\"detail\":$(python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$2")}"); echo "PASS  $1 — $2"; }
log_fail() { fail=$((fail+1)); results+=("{\"id\":\"$1\",\"status\":\"fail\",\"detail\":$(python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$2")}"); echo "FAIL  $1 — $2"; }

echo "== RNOS-21 Coach Digest Gate =="

for f in \
  services/ptt-crm-api/src/ai-intelligence/manager-coach.service.ts \
  services/ptt-crm-api/src/ai-intelligence/coach-digest.engine.ts \
  services/ptt-crm-api/src/ai-intelligence/ai-insights.repository.ts \
  services/ptt-crm-api/src/ai-intelligence/coach-digest.engine.spec.ts \
  services/ptt-crm-api/src/ai-intelligence/manager-coach.service.spec.ts \
  services/ops-web/src/app/crm/ai/coach/page.tsx \
  services/ops-web/src/components/ai/CoachDigestPanel.tsx \
  services/ops-web/e2e/coach-digest-rnos21.spec.ts \
  ptt_jobs/handlers/coach_digest.py \
  scripts/ptt_coach_digest_cron.sh; do
  [[ -f "$ROOT/$f" ]] && log_ok "artifact-${f//\//-}" "Present" || log_fail "artifact-${f//\//-}" "Missing $f"
done

grep -q "coach/generate" "$ROOT/services/ptt-crm-api/src/ai-intelligence/ai-intelligence.controller.ts" && log_ok api-generate "POST coach/generate" || log_fail api-generate "Missing generate endpoint"
grep -q "coach/current" "$ROOT/services/ptt-crm-api/src/ai-intelligence/ai-intelligence.controller.ts" && log_ok api-current "GET coach/current" || log_fail api-current "Missing current endpoint"
grep -q "/crm/ai/coach" "$ROOT/services/ops-web/src/components/OpsNav.tsx" && log_ok nav "Coach nav link" || log_fail nav "Missing nav link"
grep -q 'test:e2e:coach-digest' "$ROOT/services/ops-web/package.json" && log_ok npm-script "e2e script present" || log_fail npm-script "Missing npm script"
grep -q "coach_digest" "$ROOT/ptt_worker/__main__.py" && log_ok worker "job type registered" || log_fail worker "Missing worker handler"
grep -q "fetchCoachDigestCurrent" "$ROOT/services/ops-web/src/lib/ai-api.ts" && log_ok ai-client "fetchCoachDigestCurrent" || log_fail ai-client "Missing ai-api client"

(cd "$ROOT/services/ptt-crm-api" && npm test -- coach-digest.engine.spec.ts manager-coach.service.spec.ts --passWithNoTests 2>/dev/null) && log_ok api-unit "coach specs PASS" || log_fail api-unit "Unit tests failed"
(cd "$ROOT/services/ptt-crm-api" && npx tsc --noEmit) && log_ok api-typecheck "tsc OK" || log_fail api-typecheck "tsc failed"
(cd "$ROOT/services/ops-web" && npx tsc --noEmit) && log_ok ops-typecheck "tsc OK" || log_fail ops-typecheck "tsc failed"
python3 -m unittest tests.test_rnos21_coach_digest -v 2>/dev/null && log_ok py-unit "test_rnos21_coach_digest PASS" || log_fail py-unit "Python unit tests failed"
bash "$ROOT/scripts/playwright_ops_coach_digest_e2e.sh" && log_ok playwright "E2E PASS" || log_fail playwright "E2E failed"

mkdir -p "$(dirname "$REPORT")"
python3 - <<PY
import json, os
report = {
  "gate": "RNOS-21",
  "use_case": "AI-UC-018",
  "pass": $pass,
  "fail": $fail,
  "results": [${results[@]}],
}
with open("$REPORT", "w", encoding="utf-8") as f:
    json.dump(report, f, indent=2)
PY

echo "== Summary: $pass pass, $fail fail =="
[[ "$fail" -eq 0 ]]
