#!/usr/bin/env bash
# RNOS-22 / AI-UC-016 — NL query curated gate
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
REPORT="${REPORT:-$ROOT/.local-dev/rnos22-nl-query-gate-report.json}"
pass=0; fail=0; results=()
log_ok() { pass=$((pass+1)); results+=("{\"id\":\"$1\",\"status\":\"pass\",\"detail\":$(python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$2")}"); echo "PASS  $1 — $2"; }
log_fail() { fail=$((fail+1)); results+=("{\"id\":\"$1\",\"status\":\"fail\",\"detail\":$(python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$2")}"); echo "FAIL  $1 — $2"; }

echo "== RNOS-22 NL Query Gate =="

for f in \
  services/ptt-crm-api/src/ai-intelligence/ai-nl-query.service.ts \
  services/ptt-crm-api/src/ai-intelligence/nl-query.catalog.ts \
  services/ptt-crm-api/src/ai-intelligence/nl-query.engine.ts \
  services/ptt-crm-api/src/ai-intelligence/nl-query-context.repository.ts \
  services/ptt-crm-api/src/ai-intelligence/nl-query.engine.spec.ts \
  services/ptt-crm-api/src/ai-intelligence/ai-nl-query.service.spec.ts \
  services/ops-web/src/app/crm/ai/query/page.tsx \
  services/ops-web/src/components/ai/CuratedNlQueryPanel.tsx \
  services/ops-web/e2e/nl-query-rnos22.spec.ts; do
  [[ -f "$ROOT/$f" ]] && log_ok "artifact-${f//\//-}" "Present" || log_fail "artifact-${f//\//-}" "Missing $f"
done

grep -q "query/catalog" "$ROOT/services/ptt-crm-api/src/ai-intelligence/ai-intelligence.controller.ts" && log_ok api-catalog "GET query/catalog" || log_fail api-catalog "Missing catalog endpoint"
grep -q "Post('query')" "$ROOT/services/ptt-crm-api/src/ai-intelligence/ai-intelligence.controller.ts" && log_ok api-query "POST query" || log_fail api-query "Missing query endpoint"
grep -q "/crm/ai/query" "$ROOT/services/ops-web/src/components/OpsNav.tsx" && log_ok nav "NL query nav link" || log_fail nav "Missing nav link"
grep -q 'test:e2e:nl-query' "$ROOT/services/ops-web/package.json" && log_ok npm-script "e2e script present" || log_fail npm-script "Missing npm script"
grep -q "fetchNlQueryCatalog" "$ROOT/services/ops-web/src/lib/ai-api.ts" && log_ok ai-client "fetchNlQueryCatalog" || log_fail ai-client "Missing ai-api client"
grep -q "NL_QUERY" "$ROOT/services/ptt-crm-api/src/ai-intelligence/ai-audit.constants.ts" && log_ok audit "NL_QUERY use case" || log_fail audit "Missing audit constant"
grep -q "ai_analytics" "$ROOT/services/ptt-crm-api/src/staff-auth/staff-auth.service.ts" && log_ok cap "ai_analytics.query cap" || log_fail cap "Missing stub cap"

(cd "$ROOT/services/ptt-crm-api" && npm test -- nl-query.engine.spec.ts ai-nl-query.service.spec.ts --passWithNoTests 2>/dev/null) && log_ok api-unit "nl query specs PASS" || log_fail api-unit "Unit tests failed"
(cd "$ROOT/services/ptt-crm-api" && npx tsc --noEmit) && log_ok api-typecheck "tsc OK" || log_fail api-typecheck "tsc failed"
(cd "$ROOT/services/ops-web" && npx tsc --noEmit) && log_ok ops-typecheck "tsc OK" || log_fail ops-typecheck "tsc failed"
python3 -m unittest tests.test_rnos22_nl_query -v 2>/dev/null && log_ok py-unit "test_rnos22_nl_query PASS" || log_fail py-unit "Python unit tests failed"
bash "$ROOT/scripts/playwright_ops_nl_query_e2e.sh" && log_ok playwright "E2E PASS" || log_fail playwright "E2E failed"

mkdir -p "$(dirname "$REPORT")"
python3 - <<PY
import json, os
report = {
  "gate": "RNOS-22",
  "use_case": "AI-UC-016",
  "pass": $pass,
  "fail": $fail,
  "results": [${results[@]}],
}
with open("$REPORT", "w", encoding="utf-8") as f:
    json.dump(report, f, indent=2)
PY

echo "== Summary: $pass pass, $fail fail =="
[[ "$fail" -eq 0 ]]
