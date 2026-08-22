#!/usr/bin/env bash
# RNOS-16 — Customer timeline UI + completeness gate (AI-UC-008)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
REPORT="${REPORT:-$ROOT/.local-dev/rnos16-timeline-gate-report.json}"
pass=0; fail=0; results=()
log_ok() { pass=$((pass+1)); results+=("{\"id\":\"$1\",\"status\":\"pass\",\"detail\":$(python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$2")}"); echo "PASS  $1 — $2"; }
log_fail() { fail=$((fail+1)); results+=("{\"id\":\"$1\",\"status\":\"fail\",\"detail\":$(python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$2")}"); echo "FAIL  $1 — $2"; }

echo "== RNOS-16 Customer Timeline Gate (AI-UC-008) =="

for f in \
  services/ptt-crm-api/src/customer-timeline/customer-timeline.service.ts \
  services/ptt-crm-api/src/customers/customers.controller.ts \
  services/ops-web/src/components/crm/CustomerTimelinePanel.tsx \
  services/ops-web/src/app/crm/customers/[id]/page.tsx \
  services/ops-web/e2e/customer-timeline-rnos16.spec.ts; do
  [[ -f "$ROOT/$f" ]] && log_ok "artifact-${f//\//-}" "Present" || log_fail "artifact-${f//\//-}" "Missing $f"
done

grep -q "customers/:id/timeline" "$ROOT/services/ptt-crm-api/src/customers/customers.controller.ts" && log_ok api-customer-timeline "GET customer timeline" || log_fail api-customer-timeline "Missing customer timeline route"
grep -q "timeline/completeness" "$ROOT/services/ptt-crm-api/src/customer-timeline/customer-timeline.controller.ts" && log_ok api-completeness "GET completeness" || log_fail api-completeness "Missing completeness route"
grep -q "timeline/backfill" "$ROOT/services/ptt-crm-api/src/customer-timeline/customer-timeline.controller.ts" && log_ok api-backfill "POST backfill" || log_fail api-backfill "Missing backfill route"
grep -q "CustomerTimelinePanel" "$ROOT/services/ops-web/src/app/crm/customers/[id]/page.tsx" && log_ok ui-panel "Timeline panel wired" || log_fail ui-panel "Missing timeline panel"
grep -q 'test:e2e:customer-timeline' "$ROOT/services/ops-web/package.json" && log_ok npm-script "e2e script present" || log_fail npm-script "Missing npm script"

(cd "$ROOT/services/ptt-crm-api" && npm test -- customer-timeline.service.spec.ts --passWithNoTests 2>/dev/null) && log_ok api-unit "customer-timeline.service.spec PASS" || log_fail api-unit "Unit tests failed"
(cd "$ROOT/services/ptt-crm-api" && npx tsc --noEmit) && log_ok api-typecheck "tsc OK" || log_fail api-typecheck "tsc failed"
(cd "$ROOT/services/ops-web" && npx tsc --noEmit) && log_ok ops-typecheck "tsc OK" || log_fail ops-typecheck "tsc failed"

if [[ -x "$ROOT/scripts/playwright_ops_customer_timeline_e2e.sh" ]]; then
  bash "$ROOT/scripts/playwright_ops_customer_timeline_e2e.sh" && log_ok playwright "E2E PASS" || log_fail playwright "E2E failed"
else
  log_fail playwright "Missing playwright_ops_customer_timeline_e2e.sh"
fi

mkdir -p "$(dirname "$REPORT")"
TMP="$(mktemp)"; printf '%s\n' "${results[@]}" > "$TMP"
python3 - <<PY
import json, datetime
from pathlib import Path
checks=[json.loads(l) for l in Path("$TMP").read_text().splitlines() if l.strip()]
report={"generated_at":datetime.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),"rnos":"RNOS-16","uc":"AI-UC-008","summary":{"pass":$pass,"fail":$fail},"checks":checks}
Path("$REPORT").write_text(json.dumps(report,indent=2,ensure_ascii=False)+"\\n")
print(json.dumps(report,indent=2,ensure_ascii=False))
PY
rm -f "$TMP"
echo "PASS=$pass FAIL=$fail"; [[ "$fail" -eq 0 ]]
