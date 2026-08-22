#!/usr/bin/env bash
# RNOS-28 / AI-UC-019 — Channel anomaly narrative digest gate
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
REPORT="${REPORT:-$ROOT/.local-dev/rnos28-anomaly-digest-gate-report.json}"
pass=0; fail=0; results=()
log_ok() { pass=$((pass+1)); results+=("{\"id\":\"$1\",\"status\":\"pass\",\"detail\":$(python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$2")}"); echo "PASS  $1 — $2"; }
log_fail() { fail=$((fail+1)); results+=("{\"id\":\"$1\",\"status\":\"fail\",\"detail\":$(python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$2")}"); echo "FAIL  $1 — $2"; }

echo "== RNOS-28 Anomaly Digest Gate =="

for f in \
  services/ptt-crm-api/src/ai-intelligence/channel-anomaly.engine.ts \
  services/ptt-crm-api/src/ai-intelligence/anomaly-digest.service.ts \
  services/ptt-crm-api/src/ai-intelligence/channel-anomaly.engine.spec.ts \
  services/ptt-crm-api/src/ai-intelligence/anomaly-digest.service.spec.ts \
  services/ops-web/src/components/ai/AnomalyDigestBanner.tsx \
  services/ops-web/e2e/anomaly-digest-rnos28.spec.ts \
  scripts/playwright_ops_anomaly_digest_e2e.sh; do
  [[ -f "$ROOT/$f" ]] && log_ok "artifact-${f//\//-}" "Present" || log_fail "artifact-${f//\//-}" "Missing $f"
done

grep -q "anomaly/digest" "$ROOT/services/ptt-crm-api/src/ai-intelligence/ai-intelligence.controller.ts" && log_ok api-endpoint "GET anomaly/digest" || log_fail api-endpoint "Missing anomaly digest endpoint"
grep -q "buildChannelAnomalyCard" "$ROOT/services/ptt-crm-api/src/ai-intelligence/coach-digest.engine.ts" && log_ok coach-card "channel anomaly card in coach digest" || log_fail coach-card "Missing coach channel card"
grep -q "fetchAnomalyDigest" "$ROOT/services/ops-web/src/lib/ai-api.ts" && log_ok ai-client "fetchAnomalyDigest" || log_fail ai-client "Missing ai-api client"
grep -q "AnomalyDigestBanner" "$ROOT/services/ops-web/src/app/meta/facebook-ads/MetaFacebookAdsContent.tsx" && log_ok meta-ui "Meta hub banner wired" || log_fail meta-ui "Missing Meta banner"
grep -q "AnomalyDigestBanner" "$ROOT/services/ops-web/src/app/zalo/zalo-ads/ZaloZaloAdsContent.tsx" && log_ok zalo-ui "Zalo hub banner wired" || log_fail zalo-ui "Missing Zalo banner"
grep -q "CHANNEL_ANOMALY_DIGEST" "$ROOT/services/ptt-crm-api/src/ai-intelligence/ai-audit.constants.ts" && log_ok audit "CHANNEL_ANOMALY_DIGEST use case" || log_fail audit "Missing audit constant"
grep -q "PTT_AI_ANOMALY_DIGEST_ENABLED" "$ROOT/deploy/env.staging-phase3.example" && log_ok env-flag "Staging env flag documented" || log_fail env-flag "Missing env flag"

(cd "$ROOT/services/ptt-crm-api" && npm test -- channel-anomaly anomaly-digest coach-digest.engine.spec manager-coach.service.spec --passWithNoTests 2>/dev/null) && log_ok api-unit "anomaly digest specs PASS" || log_fail api-unit "Unit tests failed"
(cd "$ROOT/services/ptt-crm-api" && npx tsc --noEmit) && log_ok api-typecheck "tsc OK" || log_fail api-typecheck "tsc failed"
(cd "$ROOT/services/ops-web" && npx tsc --noEmit) && log_ok ops-typecheck "tsc OK" || log_fail ops-typecheck "tsc failed"
python3 -m unittest tests.test_rnos28_anomaly_digest -v 2>/dev/null && log_ok py-unit "test_rnos28_anomaly_digest PASS" || log_fail py-unit "Python unit tests failed"
bash "$ROOT/scripts/playwright_ops_anomaly_digest_e2e.sh" && log_ok playwright "E2E PASS" || log_fail playwright "E2E failed"

mkdir -p "$(dirname "$REPORT")"
results_csv=$(IFS=','; echo "${results[*]}")
python3 - <<PY
import json, os
report = {
  "gate": "RNOS-28",
  "use_case": "AI-UC-019",
  "pass": $pass,
  "fail": $fail,
  "results": [$results_csv],
}
with open("$REPORT", "w", encoding="utf-8") as f:
    json.dump(report, f, indent=2, ensure_ascii=False)
PY

echo "== Summary: $pass pass, $fail fail =="
[[ "$fail" -eq 0 ]]
