#!/usr/bin/env bash
# E0 — CSKH home widgets gate
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
fail=0
ok() { echo "OK  $*"; }
bad() { echo "FAIL $*"; fail=1; }

echo "== E0 CSKH home widgets gate =="

if [[ -f "$ROOT/services/ptt-crm-api/src/cskh-board/home-summary.util.ts" ]]; then
  ok "home-summary.util.ts"
else
  bad "missing home-summary.util.ts"
fi

if [[ -f "$ROOT/services/ops-web/src/components/home/HomeCskhWidgetRow.tsx" ]]; then
  ok "HomeCskhWidgetRow.tsx"
else
  bad "missing HomeCskhWidgetRow.tsx"
fi

if grep -q "home-summary" "$ROOT/services/ptt-crm-api/src/cskh-board/cskh-board.controller.ts" 2>/dev/null; then
  ok "GET home-summary route"
else
  bad "missing home-summary route"
fi

if grep -q "fetchCskhHomeSummary" "$ROOT/services/ops-web/src/lib/api.ts" 2>/dev/null; then
  ok "fetchCskhHomeSummary client"
else
  bad "missing fetchCskhHomeSummary"
fi

if grep -q "HomeCskhWidgetRow" "$ROOT/services/ops-web/src/app/page.tsx" 2>/dev/null; then
  ok "home page widgets wired"
else
  bad "home page missing widgets"
fi

if (cd "$ROOT/services/ptt-crm-api" && npx jest src/cskh-board/home-summary.util.spec.ts --silent 2>/dev/null); then
  ok "home-summary.util.spec.ts"
else
  bad "home-summary unit tests failed"
fi

if [[ "$fail" -eq 0 ]]; then
  echo "E0 CSKH home widgets gate PASSED"
  exit 0
fi
echo "E0 CSKH home widgets gate FAILED"
exit 1
