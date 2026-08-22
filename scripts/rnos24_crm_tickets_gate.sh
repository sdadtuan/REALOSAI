#!/usr/bin/env bash
# RNOS-24 — CRM tickets lite CRUD gate
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

REPORT="${REPORT:-$ROOT/.local-dev/rnos24-crm-tickets-gate-report.json}"
pass=0
fail=0
results=()

log_ok() { pass=$((pass + 1)); results+=("{\"id\":\"$1\",\"status\":\"pass\",\"detail\":$(python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$2")}"); echo "PASS  $1 — $2"; }
log_fail() { fail=$((fail + 1)); results+=("{\"id\":\"$1\",\"status\":\"fail\",\"detail\":$(python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$2")}"); echo "FAIL  $1 — $2"; }

echo "== RNOS-24 CRM Tickets Gate =="

for f in \
  services/ptt-crm-api/src/tickets/tickets.module.ts \
  services/ptt-crm-api/src/tickets/tickets.controller.ts \
  services/ptt-crm-api/src/ai-intelligence/ticket-sentiment.engine.ts \
  services/ptt-crm-api/src/ai-intelligence/ai-ticket-sentiment.service.ts \
  services/ops-web/src/lib/ai-api.ts \
  services/ops-web/src/app/crm/tickets/page.tsx \
  services/ops-web/e2e/crm-tickets-rnos24.spec.ts \
  scripts/playwright_ops_crm_tickets_e2e.sh; do
  if [[ -f "$ROOT/$f" ]]; then
    log_ok "artifact-${f//\//-}" "Present"
  else
    log_fail "artifact-${f//\//-}" "Missing $f"
  fi
done

if grep -q 'crm-tickets-table' "$ROOT/services/ops-web/src/app/globals.css"; then
  log_ok "css-tickets" "Tickets CSS present"
else
  log_fail "css-tickets" "Missing tickets CSS"
fi

if grep -q 'fetchCrmTickets' "$ROOT/services/ops-web/src/lib/api.ts"; then
  log_ok "api-helpers" "Tickets API helpers present"
else
  log_fail "api-helpers" "Missing tickets API helpers"
fi

if grep -q 'postTicketSentiment' "$ROOT/services/ops-web/src/lib/ai-api.ts"; then
  log_ok "api-sentiment" "Ticket sentiment API helper present"
else
  log_fail "api-sentiment" "Missing postTicketSentiment helper"
fi

if grep -q 'crm-tickets-sentiment--negative' "$ROOT/services/ops-web/src/app/globals.css"; then
  log_ok "css-sentiment" "Ticket sentiment CSS present"
else
  log_fail "css-sentiment" "Missing ticket sentiment CSS"
fi

echo "==> ptt-crm-api unit tests (ticket sentiment)"
if (
  cd "$ROOT/services/ptt-crm-api"
  npm test -- --runInBand ticket-sentiment ai-ticket-sentiment 2>/dev/null
); then
  log_ok "api-unit-sentiment" "ticket sentiment unit tests PASS"
else
  log_fail "api-unit-sentiment" "ticket sentiment unit tests failed"
fi

if grep -q '/crm/tickets' "$ROOT/services/ops-web/src/components/OpsNav.tsx"; then
  log_ok "ops-nav" "Tickets nav link present"
else
  log_fail "ops-nav" "Missing tickets nav link"
fi

if grep -q 'test:e2e:crm-tickets' "$ROOT/services/ops-web/package.json"; then
  log_ok "npm-script" 'test:e2e:crm-tickets in package.json'
else
  log_fail "npm-script" 'Add test:e2e:crm-tickets script'
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

echo "==> ops-web TypeScript check"
if (
  cd "$ROOT/services/ops-web"
  npx tsc --noEmit
); then
  log_ok "ops-web-typecheck" "tsc --noEmit OK"
else
  log_fail "ops-web-typecheck" "TypeScript check failed"
fi

if bash "$ROOT/scripts/playwright_ops_crm_tickets_e2e.sh"; then
  log_ok "playwright-e2e" "crm-tickets-rnos24.spec.ts PASS"
else
  log_fail "playwright-e2e" "Playwright tickets E2E failed"
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
  "rnos": "RNOS-24",
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
