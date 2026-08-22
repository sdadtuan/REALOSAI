#!/usr/bin/env bash
# RNOS-09/10 — Deal score + NBA gate
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
REPORT="${REPORT:-$ROOT/.local-dev/rnos09-10-nba-deal-score-gate-report.json}"
pass=0; fail=0; results=()
log_ok() { pass=$((pass+1)); results+=("{\"id\":\"$1\",\"status\":\"pass\",\"detail\":$(python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$2")}"); echo "PASS  $1 — $2"; }
log_fail() { fail=$((fail+1)); results+=("{\"id\":\"$1\",\"status\":\"fail\",\"detail\":$(python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$2")}"); echo "FAIL  $1 — $2"; }

echo "== RNOS-09/10 Deal Score + NBA Gate =="

for f in \
  services/ptt-crm-api/src/ai-intelligence/ai-deal-score.service.ts \
  services/ptt-crm-api/src/ai-intelligence/ai-nba.service.ts \
  services/ptt-crm-api/src/ai-intelligence/deal-score.engine.ts \
  services/ops-web/src/components/ai/NbaCard.tsx \
  services/ops-web/src/components/ai/DealScoreMiniBar.tsx \
  services/ops-web/src/components/sales/SalesPipelineFunnelPanel.tsx \
  services/ops-web/e2e/nba-deal-score-rnos09-10.spec.ts; do
  [[ -f "$ROOT/$f" ]] && log_ok "artifact-${f//\//-}" "Present" || log_fail "artifact-${f//\//-}" "Missing $f"
done

grep -q "score/deal" "$ROOT/services/ptt-crm-api/src/ai-intelligence/ai-intelligence.controller.ts" && log_ok api-score-deal "POST score/deal" || log_fail api-score-deal "Missing score/deal"
grep -q "next-best-action" "$ROOT/services/ptt-crm-api/src/ai-intelligence/ai-intelligence.controller.ts" && log_ok api-nba "POST next-best-action" || log_fail api-nba "Missing NBA endpoint"
grep -q "postAiScoreDeal" "$ROOT/services/ops-web/src/lib/ai-api.ts" && log_ok ai-client "postAiScoreDeal in ai-api" || log_fail ai-client "Missing ai-api client"
grep -q "SalesPipelineFunnelPanel" "$ROOT/services/ops-web/src/app/crm/sales/page.tsx" && log_ok sales-ui "Pipeline funnel panel wired" || log_fail sales-ui "Missing funnel panel"
grep -q 'test:e2e:nba-deal-score' "$ROOT/services/ops-web/package.json" && log_ok npm-script "e2e script present" || log_fail npm-script "Missing npm script"

(cd "$ROOT/services/ptt-crm-api" && npm test -- deal-score.engine.spec.ts --passWithNoTests 2>/dev/null) && log_ok api-unit "deal-score.engine.spec PASS" || log_fail api-unit "Unit tests failed"
(cd "$ROOT/services/ptt-crm-api" && npx tsc --noEmit) && log_ok api-typecheck "tsc OK" || log_fail api-typecheck "tsc failed"
(cd "$ROOT/services/ops-web" && npx tsc --noEmit) && log_ok ops-typecheck "tsc OK" || log_fail ops-typecheck "tsc failed"
bash "$ROOT/scripts/playwright_ops_nba_deal_score_e2e.sh" && log_ok playwright "E2E PASS" || log_fail playwright "E2E failed"

mkdir -p "$(dirname "$REPORT")"
TMP="$(mktemp)"; printf '%s\n' "${results[@]}" > "$TMP"
python3 - <<PY
import json, datetime
from pathlib import Path
checks=[json.loads(l) for l in Path("$TMP").read_text().splitlines() if l.strip()]
report={"generated_at":datetime.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),"rnos":"RNOS-09/10","summary":{"pass":$pass,"fail":$fail},"checks":checks}
Path("$REPORT").write_text(json.dumps(report,indent=2,ensure_ascii=False)+"\\n")
print(json.dumps(report,indent=2,ensure_ascii=False))
PY
rm -f "$TMP"
echo "PASS=$pass FAIL=$fail"; [[ "$fail" -eq 0 ]]
