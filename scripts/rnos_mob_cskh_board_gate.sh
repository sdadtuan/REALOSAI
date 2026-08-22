#!/usr/bin/env bash
# SCR-MOB-004 — CSKH board mobile cards gate (CSS + component + Playwright @390px)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

REPORT="${REPORT:-$ROOT/.local-dev/rnos-mob-cskh-board-gate-report.json}"
pass=0
fail=0
results=()

log_ok() { pass=$((pass + 1)); results+=("{\"id\":\"$1\",\"status\":\"pass\",\"detail\":$(python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$2")}"); echo "PASS  $1 — $2"; }
log_fail() { fail=$((fail + 1)); results+=("{\"id\":\"$1\",\"status\":\"fail\",\"detail\":$(python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$2")}"); echo "FAIL  $1 — $2"; }

echo "== SCR-MOB-004 CSKH Board Mobile Gate =="

for f in \
  services/ops-web/src/app/crm/cskh-board/CskhBoardContent.tsx \
  services/ops-web/e2e/cskh-board-mobile.spec.ts \
  scripts/playwright_ops_cskh_board_mobile_e2e.sh; do
  if [[ -f "$ROOT/$f" ]]; then
    log_ok "artifact-${f//\//-}" "Present"
  else
    log_fail "artifact-${f//\//-}" "Missing $f"
  fi
done

if grep -q 'cskh-board-cards' "$ROOT/services/ops-web/src/app/globals.css"; then
  log_ok "css-mobile-cards" "cskh-board-cards in globals.css"
else
  log_fail "css-mobile-cards" "Missing mobile card CSS"
fi

if grep -q 'cskh-board-summary-chips' "$ROOT/services/ops-web/src/app/globals.css"; then
  log_ok "css-summary-chips" "sticky SLA chips CSS present"
else
  log_fail "css-summary-chips" "Missing summary chips CSS"
fi

if grep -q 'CskhLeadCard' "$ROOT/services/ops-web/src/app/crm/cskh-board/CskhBoardContent.tsx"; then
  log_ok "component-card" "CskhLeadCard component in CskhBoardContent"
else
  log_fail "component-card" "Missing CskhLeadCard"
fi

if grep -q 'data-testid="cskh-board-cards"' "$ROOT/services/ops-web/src/app/crm/cskh-board/CskhBoardContent.tsx"; then
  log_ok "testid-cards" "data-testid cskh-board-cards"
else
  log_fail "testid-cards" "Missing data-testid on card list"
fi

if grep -q 'test:e2e:cskh-board-mobile' "$ROOT/services/ops-web/package.json"; then
  log_ok "npm-script" 'test:e2e:cskh-board-mobile in package.json'
else
  log_fail "npm-script" 'Add test:e2e:cskh-board-mobile script'
fi

if grep -q 'cskh-board-table-wrap' "$ROOT/services/ops-web/src/app/crm/cskh-board/CskhBoardContent.tsx"; then
  log_ok "table-wrap-class" "Desktop table wrapper class present"
else
  log_fail "table-wrap-class" "Missing cskh-board-table-wrap"
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

echo "==> Playwright mobile viewport E2E"
if bash "$ROOT/scripts/playwright_ops_cskh_board_mobile_e2e.sh"; then
  log_ok "playwright-e2e" "cskh-board-mobile.spec.ts PASS"
else
  log_fail "playwright-e2e" "Playwright CSKH mobile E2E failed"
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
  "rnos": "SCR-MOB-004",
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
