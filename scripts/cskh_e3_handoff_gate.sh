#!/usr/bin/env bash
# E3 — shift handoff + review queue LLM triage gate
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
fail=0
ok() { echo "OK  $*"; }
bad() { echo "FAIL $*"; fail=1; }

echo "== E3 smart ops gate =="

if [[ -f "$ROOT/services/ptt-crm-api/src/cskh-board/cskh-shift-handoff.util.ts" ]]; then
  ok "cskh-shift-handoff.util.ts"
else
  bad "missing cskh-shift-handoff.util.ts"
fi

if grep -q "shift-handoff" "$ROOT/services/ptt-crm-api/src/cskh-board/cskh-board.controller.ts" 2>/dev/null; then
  ok "shift-handoff route"
else
  bad "missing shift-handoff route"
fi

if [[ -f "$ROOT/services/ptt-crm-api/src/leads-funnel/review-queue-llm.service.ts" ]]; then
  ok "review-queue-llm.service.ts"
else
  bad "missing review-queue-llm.service.ts"
fi

if grep -q "REVIEW_QUEUE_TRIAGE" "$ROOT/services/ptt-crm-api/src/ai-intelligence/ai-audit.constants.ts" 2>/dev/null; then
  ok "review_queue_triage audit use_case"
else
  bad "missing review_queue_triage use_case"
fi

if grep -q "mode=llm\\|mode === 'llm'" "$ROOT/services/ptt-crm-api/src/leads-funnel/leads-funnel.controller.ts" 2>/dev/null; then
  ok "review-queue ai-summaries mode=llm"
else
  bad "missing mode=llm on ai-summaries"
fi

if [[ -f "$ROOT/services/ops-web/src/components/crm/CskhShiftHandoffPanel.tsx" ]]; then
  ok "CskhShiftHandoffPanel.tsx"
else
  bad "missing CskhShiftHandoffPanel"
fi

if grep -q "fetchCskhShiftHandoff" "$ROOT/services/ops-web/src/lib/api.ts" 2>/dev/null; then
  ok "fetchCskhShiftHandoff client"
else
  bad "missing fetchCskhShiftHandoff"
fi

if grep -q "review-queue-priority" "$ROOT/services/ops-web/src/app/crm/leads/review-queue/page.tsx" 2>/dev/null; then
  ok "review queue priority UI"
else
  bad "missing review queue priority UI"
fi

if (cd "$ROOT/services/ptt-crm-api" && npx jest src/cskh-board/cskh-shift-handoff.util.spec.ts --silent 2>/dev/null); then
  ok "cskh-shift-handoff.util.spec.ts"
else
  bad "shift-handoff unit tests failed"
fi

if [[ "$fail" -eq 0 ]]; then
  echo "E3 smart ops gate PASSED"
  exit 0
fi
echo "E3 smart ops gate FAILED"
exit 1
