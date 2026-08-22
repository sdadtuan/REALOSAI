#!/usr/bin/env bash
# RNOS-13…15 / UI-R2-04 — Automation workflows gate
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

REPORT="${REPORT:-$ROOT/.local-dev/rnos13-automation-workflows-gate-report.json}"
pass=0
fail=0
results=()

log_ok() { pass=$((pass + 1)); results+=("{\"id\":\"$1\",\"status\":\"pass\",\"detail\":$(python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$2")}"); echo "PASS  $1 — $2"; }
log_fail() { fail=$((fail + 1)); results+=("{\"id\":\"$1\",\"status\":\"fail\",\"detail\":$(python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$2")}"); echo "FAIL  $1 — $2"; }

echo "== RNOS-13 Automation Workflows Gate =="

for f in \
  services/ptt-crm-api/src/automation-workflows/automation-workflows.controller.ts \
  services/ptt-crm-api/src/automation-workflows/automation-workflows.service.ts \
  services/ops-web/src/components/automation/AutomationWorkflowsPanel.tsx \
  services/ops-web/src/app/crm/automation/page.tsx \
  services/ops-web/e2e/automation-workflows-rnos13.spec.ts \
  scripts/playwright_ops_automation_workflows_e2e.sh; do
  if [[ -f "$ROOT/$f" ]]; then
    log_ok "artifact-${f//\//-}" "Present"
  else
    log_fail "artifact-${f//\//-}" "Missing $f"
  fi
done

if grep -q 'StaffAutomationViewGuard' "$ROOT/services/ptt-crm-api/src/automation-workflows/automation-workflows.controller.ts"; then
  log_ok "api-guard" "StaffAutomation guards on automation-workflows routes"
else
  log_fail "api-guard" "Missing automation workflow guards"
fi

if grep -q 'simulate' "$ROOT/services/ptt-crm-api/src/automation-workflows/automation-workflows.controller.ts"; then
  log_ok "api-simulate" "POST simulate endpoint wired (RNOS-15)"
else
  log_fail "api-simulate" "Missing simulate endpoint"
fi

if grep -q 'fetchAutomationWorkflows' "$ROOT/services/ops-web/src/lib/automation-api.ts"; then
  log_ok "api-client" "automation-api.ts client present"
else
  log_fail "api-client" "Missing automation-api client"
fi

if grep -q "section: 'automation_workflows'" "$ROOT/services/ptt-crm-api/src/staff-auth/staff-auth.service.ts"; then
  log_ok "rbac-cap" "automation_workflows caps in stub auth"
else
  log_fail "rbac-cap" "Missing automation_workflows caps"
fi

if grep -q '/crm/automation' "$ROOT/services/ops-web/src/components/OpsNav.tsx"; then
  log_ok "ops-nav" "Workflow automation nav link"
else
  log_fail "ops-nav" "Missing OpsNav link"
fi

if grep -q 'automation-workflows-panel' "$ROOT/services/ops-web/src/app/globals.css"; then
  log_ok "css-panel" "automation-workflows styles present"
else
  log_fail "css-panel" "Missing automation CSS"
fi

if grep -q 'test:e2e:automation-workflows' "$ROOT/services/ops-web/package.json"; then
  log_ok "npm-script" 'test:e2e:automation-workflows in package.json'
else
  log_fail "npm-script" 'Add test:e2e:automation-workflows script'
fi

echo "==> ptt-crm-api unit tests (automation-workflows.service)"
if (cd "$ROOT/services/ptt-crm-api" && npm test -- automation-workflows.service.spec.ts --passWithNoTests 2>/dev/null); then
  log_ok "api-unit" "automation-workflows.service.spec.ts PASS"
else
  log_fail "api-unit" "Service unit tests failed"
fi

echo "==> ptt-crm-api TypeScript check"
if (cd "$ROOT/services/ptt-crm-api" && npx tsc --noEmit); then
  log_ok "api-typecheck" "tsc --noEmit OK"
else
  log_fail "api-typecheck" "TypeScript check failed"
fi

echo "==> ops-web TypeScript check"
if (cd "$ROOT/services/ops-web" && npx tsc --noEmit); then
  log_ok "ops-web-typecheck" "tsc --noEmit OK"
else
  log_fail "ops-web-typecheck" "TypeScript check failed"
fi

if bash "$ROOT/scripts/playwright_ops_automation_workflows_e2e.sh"; then
  log_ok "playwright-e2e" "automation-workflows-rnos13.spec.ts PASS"
else
  log_fail "playwright-e2e" "Playwright RNOS-13 E2E failed"
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
  "rnos": "RNOS-13",
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
