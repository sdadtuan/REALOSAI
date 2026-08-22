#!/usr/bin/env bash
# RNOS-29 — AI acceptance feedback loop gate
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

REPORT="${REPORT:-$ROOT/.local-dev/rnos29-ai-feedback-gate-report.json}"
pass=0
fail=0
results=()

log_ok() { pass=$((pass + 1)); results+=("{\"id\":\"$1\",\"status\":\"pass\",\"detail\":$(python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$2")}"); echo "PASS  $1 — $2"; }
log_fail() { fail=$((fail + 1)); results+=("{\"id\":\"$1\",\"status\":\"fail\",\"detail\":$(python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$2")}"); echo "FAIL  $1 — $2"; }

echo "== RNOS-29 AI Feedback Gate =="

for f in \
  services/ptt-crm-api/src/ai-intelligence/ai-feedback-analytics.service.ts \
  services/ptt-crm-api/src/ai-intelligence/feedback-analytics.types.ts \
  services/ops-web/src/components/ai/DismissReasonModal.tsx \
  services/ops-web/src/components/ai/InsightsInboxTable.tsx \
  services/ops-web/src/app/crm/ai/insights/page.tsx \
  services/ops-web/e2e/ai-feedback-rnos29.spec.ts \
  scripts/playwright_ops_ai_feedback_e2e.sh; do
  if [[ -f "$ROOT/$f" ]]; then
    log_ok "artifact-${f//\//-}" "Present"
  else
    log_fail "artifact-${f//\//-}" "Missing $f"
  fi
done

if grep -q 'fetchAiAcceptanceMetrics' "$ROOT/services/ops-web/src/lib/ai-api.ts"; then
  log_ok "api-helpers" "AI acceptance analytics helpers present"
else
  log_fail "api-helpers" "Missing fetchAiAcceptanceMetrics"
fi

if grep -q 'Tỷ lệ chấp nhận AI' "$ROOT/services/ops-web/src/app/crm/kpi/page.tsx"; then
  log_ok "kpi-tile" "AI acceptance tile on /crm/kpi"
else
  log_fail "kpi-tile" "Missing AI acceptance tile"
fi

if grep -q 'DismissReasonModal' "$ROOT/services/ops-web/src/components/ai/FollowUpDraftSection.tsx"; then
  log_ok "dismiss-modal" "Follow-up dismiss modal wired"
else
  log_fail "dismiss-modal" "Missing dismiss modal integration"
fi

if grep -q '/crm/ai/insights' "$ROOT/services/ops-web/src/components/OpsNav.tsx"; then
  log_ok "ops-nav" "AI insights nav link present"
else
  log_fail "ops-nav" "Missing AI insights nav link"
fi

if grep -q 'analytics/acceptance' "$ROOT/services/ptt-crm-api/src/ai-intelligence/ai-intelligence.controller.ts"; then
  log_ok "api-endpoint" "GET /api/v1/ai/analytics/acceptance present"
else
  log_fail "api-endpoint" "Missing analytics endpoint"
fi

if grep -q 'test:e2e:ai-feedback' "$ROOT/services/ops-web/package.json"; then
  log_ok "npm-script" 'test:e2e:ai-feedback in package.json'
else
  log_fail "npm-script" 'Add test:e2e:ai-feedback script'
fi

echo "==> ptt-crm-api TypeScript check"
if (
  cd "$ROOT/services/ptt-crm-api"
  npx tsc --noEmit
); then
  log_ok "api-typecheck" "tsc --noEmit OK"
else
  log_fail "api-typecheck" "TypeScript check failed"
fi

echo "==> ptt-crm-api unit tests (feedback analytics)"
if (
  cd "$ROOT/services/ptt-crm-api"
  npm test -- --testPathPattern=ai-feedback-analytics.service.spec.ts --passWithNoTests
); then
  log_ok "api-unit" "ai-feedback-analytics.service.spec.ts PASS"
else
  log_fail "api-unit" "Unit tests failed"
fi

echo "==> ops-web TypeScript check"
if (
  cd "$ROOT/services/ops-web"
  npx tsc --noEmit
); then
  log_ok "ops-web-typecheck" "tsc --noEmit OK"
else
  log_fail "ops-web-typecheck" "TypeScript check failed"
fi

if bash "$ROOT/scripts/playwright_ops_ai_feedback_e2e.sh"; then
  log_ok "playwright-e2e" "ai-feedback-rnos29.spec.ts PASS"
else
  log_fail "playwright-e2e" "Playwright AI feedback E2E failed"
fi

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
  "rnos": "RNOS-29",
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
