#!/usr/bin/env bash
# E2 — predictive SLA + alerts gate
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
fail=0
ok() { echo "OK  $*"; }
bad() { echo "FAIL $*"; fail=1; }

echo "== E2 predictive SLA gate =="

if [[ -f "$ROOT/services/ptt-crm-api/src/cskh-board/sla-predict.util.ts" ]]; then
  ok "sla-predict.util.ts"
else
  bad "missing sla-predict.util.ts"
fi

if grep -q "sla-predictions" "$ROOT/services/ptt-crm-api/src/cskh-board/cskh-board.controller.ts" 2>/dev/null; then
  ok "sla-predictions route"
else
  bad "missing sla-predictions route"
fi

if grep -q "sla-alerts/stream" "$ROOT/services/ptt-crm-api/src/cskh-board/cskh-board.controller.ts" 2>/dev/null; then
  ok "sla-alerts SSE route"
else
  bad "missing sla-alerts SSE route"
fi

if grep -q "sla-auto-task" "$ROOT/services/ptt-crm-api/src/leads/leads.controller.ts" 2>/dev/null; then
  ok "sla-auto-task route"
else
  bad "missing sla-auto-task route"
fi

if [[ -f "$ROOT/services/ops-web/src/components/crm/SlaAlertToastHost.tsx" ]]; then
  ok "SlaAlertToastHost.tsx"
else
  bad "missing SlaAlertToastHost"
fi

if grep -q "fetchCskhSlaPredictions" "$ROOT/services/ops-web/src/lib/api.ts" 2>/dev/null; then
  ok "fetchCskhSlaPredictions client"
else
  bad "missing fetchCskhSlaPredictions"
fi

if (cd "$ROOT/services/ptt-crm-api" && npx jest src/cskh-board/sla-predict.util.spec.ts --silent 2>/dev/null); then
  ok "sla-predict.util.spec.ts"
else
  bad "sla-predict unit tests failed"
fi

if [[ "$fail" -eq 0 ]]; then
  echo "E2 predictive SLA gate PASSED"
  exit 0
fi
echo "E2 predictive SLA gate FAILED"
exit 1
