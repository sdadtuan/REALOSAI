#!/usr/bin/env bash
# E1 — CSKH AI prod rollout gate
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
fail=0
ok() { echo "OK  $*"; }
bad() { echo "FAIL $*"; fail=1; }

echo "== E1 CSKH AI prod rollout gate =="

if grep -q "copilotRolloutMode" "$ROOT/services/ptt-crm-api/src/ai-intelligence/ai-intelligence.config.ts" 2>/dev/null; then
  ok "copilot rollout mode config"
else
  bad "missing copilot rollout mode"
fi

if grep -q "nbaLlmPrimary" "$ROOT/services/ptt-crm-api/src/ai-intelligence/ai-intelligence.config.ts" 2>/dev/null; then
  ok "NBA LLM primary config"
else
  bad "missing NBA LLM primary config"
fi

if grep -q "canUseCopilot" "$ROOT/services/ptt-crm-api/src/ai-intelligence/guards/staff-ai-copilot.guard.ts" 2>/dev/null; then
  ok "StaffAiCopilotGuard rollout check"
else
  bad "copilot guard missing rollout"
fi

if grep -q "analytics/dismiss-reasons" "$ROOT/services/ptt-crm-api/src/ai-intelligence/ai-intelligence.controller.ts" 2>/dev/null; then
  ok "dismiss-reasons API"
else
  bad "missing dismiss-reasons API"
fi

if grep -q "canUseAiCopilot" "$ROOT/services/ops-web/src/lib/ai-flags.ts" 2>/dev/null; then
  ok "ops-web canUseAiCopilot"
else
  bad "missing canUseAiCopilot"
fi

if grep -q "fetchAiDismissReasons" "$ROOT/services/ops-web/src/lib/ai-api.ts" 2>/dev/null; then
  ok "fetchAiDismissReasons client"
else
  bad "missing fetchAiDismissReasons"
fi

if (cd "$ROOT/services/ptt-crm-api" && npx jest \
  src/ai-intelligence/ai-intelligence.config.spec.ts \
  src/ai-intelligence/guards/staff-ai-copilot.guard.spec.ts \
  --silent 2>/dev/null); then
  ok "E1 unit tests"
else
  bad "E1 unit tests failed"
fi

if [[ "$fail" -eq 0 ]]; then
  echo "E1 CSKH AI prod rollout gate PASSED"
  exit 0
fi
echo "E1 CSKH AI prod rollout gate FAILED"
exit 1
