#!/usr/bin/env bash
# P0-2 — Lead import/export Excel gate
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

REPORT="${REPORT:-$ROOT/.local-dev/p02-leads-excel-gate-report.json}"
pass=0
fail=0
results=()

log_ok() { pass=$((pass + 1)); results+=("{\"id\":\"$1\",\"status\":\"pass\",\"detail\":$(python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$2")}"); echo "PASS  $1 — $2"; }
log_fail() { fail=$((fail + 1)); results+=("{\"id\":\"$1\",\"status\":\"fail\",\"detail\":$(python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$2")}"); echo "FAIL  $1 — $2"; }

echo "== P0-2 Lead Excel Gate =="

for f in \
  services/ptt-crm-api/src/leads/leads-io.constants.ts \
  services/ptt-crm-api/src/leads/leads-io.util.ts \
  services/ptt-crm-api/src/leads/leads-io.service.ts \
  services/ops-web/src/components/crm/CrmLeadsImportExport.tsx \
  services/ops-web/e2e/leads-excel-p02.spec.ts \
  scripts/playwright_ops_leads_excel_e2e.sh; do
  if [[ -f "$ROOT/$f" ]]; then
    log_ok "artifact-${f//\//-}" "Present"
  else
    log_fail "artifact-${f//\//-}" "Missing $f"
  fi
done

if grep -q 'export.xlsx' "$ROOT/services/ptt-crm-api/src/leads/leads.controller.ts"; then
  log_ok "api-export" 'GET /api/v1/leads/export.xlsx'
else
  log_fail "api-export" 'Missing export route'
fi

if grep -q 'test:e2e:leads-excel' "$ROOT/services/ops-web/package.json"; then
  log_ok "npm-script" 'test:e2e:leads-excel in package.json'
else
  log_fail "npm-script" 'Add test:e2e:leads-excel script'
fi

echo "==> ptt-crm-api build"
if (cd "$ROOT/services/ptt-crm-api" && npm run build); then
  log_ok "api-build" "nest build OK"
else
  log_fail "api-build" "nest build failed"
fi

echo "==> ops-web TypeScript check"
if (cd "$ROOT/services/ops-web" && npx tsc --noEmit); then
  log_ok "ops-web-typecheck" "tsc --noEmit OK"
else
  log_fail "ops-web-typecheck" "TypeScript check failed"
fi

if bash "$ROOT/scripts/playwright_ops_leads_excel_e2e.sh"; then
  log_ok "playwright-e2e" "leads-excel-p02.spec.ts PASS"
else
  log_fail "playwright-e2e" "Playwright P0-2 E2E failed"
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
  "rnos": "P0-2",
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
