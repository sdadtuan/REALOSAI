#!/usr/bin/env bash
# P2 — R4 & DoD v1 gate (AI-UC-019 polish, RNOS-26 ML, adoption, RNOS-16, CRM parity)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
REPORT="${REPORT:-$ROOT/.local-dev/rnos-p2-r4-dod-gate-report.json}"
pass=0; fail=0; results=()
log_ok() { pass=$((pass+1)); results+=("{\"id\":\"$1\",\"status\":\"pass\",\"detail\":$(python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$2")}"); echo "PASS  $1 — $2"; }
log_fail() { fail=$((fail+1)); results+=("{\"id\":\"$1\",\"status\":\"fail\",\"detail\":$(python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$2")}"); echo "FAIL  $1 — $2"; }

echo "== P2 R4 & DoD v1 Gate =="

for f in \
  services/ptt-crm-api/src/ai-intelligence/lead-route-ml.engine.ts \
  services/ptt-crm-api/src/ai-intelligence/ai-adoption-analytics.service.ts \
  services/ops-web/src/components/ai/CopilotAdoptionPanel.tsx \
  services/ops-web/src/components/crm/LeadEntityTimelinePanel.tsx \
  services/ops-web/src/components/meta/MetaBudgetRecommendCard.tsx; do
  [[ -f "$ROOT/$f" ]] && log_ok "artifact-${f//\//-}" "Present" || log_fail "artifact-${f//\//-}" "Missing $f"
done

grep -q "analytics/adoption" "$ROOT/services/ptt-crm-api/src/ai-intelligence/ai-intelligence.controller.ts" && log_ok api-adoption "GET analytics/adoption" || log_fail api-adoption "Missing adoption API"
grep -q "leadRoutingMlEnabled" "$ROOT/services/ptt-crm-api/src/ai-intelligence/ai-intelligence.config.ts" && log_ok config-ml "PTT_AI_LEAD_ROUTING_ML_ENABLED" || log_fail config-ml "Missing ML flag"
grep -q "computeLeadRouteMlV1" "$ROOT/services/ptt-crm-api/src/ai-intelligence/ai-lead-route.service.ts" && log_ok route-ml "ML engine wired" || log_fail route-ml "Missing ML routing"
grep -q "recordAiAction" "$ROOT/services/ptt-crm-api/src/customer-timeline/customer-timeline.service.ts" && log_ok timeline-ai "AI timeline mirror" || log_fail timeline-ai "Missing recordAiAction"
grep -q "bulk-assign" "$ROOT/services/ptt-crm-api/src/leads/leads.controller.ts" && log_ok leads-bulk "POST bulk-assign" || log_fail leads-bulk "Missing bulk assign"
grep -q "unassigned_only" "$ROOT/services/ptt-crm-api/src/leads/leads.controller.ts" && log_ok leads-filter "owner/unassigned filters" || log_fail leads-filter "Missing list filters"
grep -q "fetchAiAdoptionMetrics" "$ROOT/services/ops-web/src/lib/ai-api.ts" && log_ok ai-client-adoption "fetchAiAdoptionMetrics" || log_fail ai-client-adoption "Missing adoption client"
grep -q "CopilotAdoptionPanel" "$ROOT/services/ops-web/src/app/crm/ai/insights/page.tsx" && log_ok ui-adoption "Adoption panel on insights" || log_fail ui-adoption "Missing adoption UI"
grep -q "MetaBudgetRecommendCard" "$ROOT/services/ops-web/src/app/meta/facebook-ads/MetaFacebookAdsContent.tsx" && log_ok ui-budget "Budget card on Meta hub" || log_fail ui-budget "Missing budget card"
grep -q "AnomalyDigestBanner" "$ROOT/services/ops-web/src/app/agency/clients/[id]/AgencyClientDetailContent.tsx" && log_ok ui-agency-anomaly "Agency anomaly context" || log_fail ui-agency-anomaly "Missing agency anomaly"
grep -q "LeadEntityTimelinePanel" "$ROOT/services/ops-web/src/app/crm/leads/[id]/page.tsx" && log_ok ui-lead-timeline "Lead unified timeline" || log_fail ui-lead-timeline "Missing lead timeline"
grep -q "bulkAssignLeads" "$ROOT/services/ops-web/src/app/crm/leads/page.tsx" && log_ok ui-bulk-assign "Bulk assign toolbar" || log_fail ui-bulk-assign "Missing bulk assign UI"
grep -q 'copilot-trust-footer' "$ROOT/services/ops-web/src/components/ai/LeadCopilotPanel.tsx" && log_ok ui-trust-footer "Copilot trust footer" || log_fail ui-trust-footer "Missing trust footer"

(cd "$ROOT/services/ptt-crm-api" && npm test -- lead-route-ml.engine.spec.ts ai-adoption-analytics.service.spec.ts --passWithNoTests 2>/dev/null) && log_ok api-unit "P2 unit specs PASS" || log_fail api-unit "Unit tests failed"
(cd "$ROOT/services/ptt-crm-api" && npx tsc --noEmit) && log_ok api-typecheck "tsc OK" || log_fail api-typecheck "tsc failed"
(cd "$ROOT/services/ops-web" && npx tsc --noEmit) && log_ok ops-typecheck "tsc OK" || log_fail ops-typecheck "tsc failed"
bash "$ROOT/scripts/rnos28_anomaly_digest_gate.sh" && log_ok rnos28 "RNOS-28 gate PASS" || log_fail rnos28 "RNOS-28 gate failed"

mkdir -p "$(dirname "$REPORT")"
TMP="$(mktemp)"; printf '%s\n' "${results[@]}" > "$TMP"
python3 - <<PY
import json, datetime
from pathlib import Path
checks=[json.loads(l) for l in Path("$TMP").read_text().splitlines() if l.strip()]
report={"generated_at":datetime.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),"rnos":"P2-R4-DoD-v1","summary":{"pass":$pass,"fail":$fail},"checks":checks}
Path("$REPORT").write_text(json.dumps(report,indent=2,ensure_ascii=False)+"\\n")
print(json.dumps(report,indent=2,ensure_ascii=False))
PY
rm -f "$TMP"
echo "PASS=$pass FAIL=$fail"; [[ "$fail" -eq 0 ]]
