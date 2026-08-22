#!/usr/bin/env bash
# UI-R1-09 / RNOS-05 — Admin AI agent runs gate
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

REPORT="${REPORT:-$ROOT/.local-dev/ui-r1-09-admin-ai-runs-gate-report.json}"
pass=0
fail=0
results=()

log_ok() { pass=$((pass + 1)); results+=("{\"id\":\"$1\",\"status\":\"pass\",\"detail\":$(python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$2")}"); echo "PASS  $1 — $2"; }
log_fail() { fail=$((fail + 1)); results+=("{\"id\":\"$1\",\"status\":\"fail\",\"detail\":$(python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$2")}"); echo "FAIL  $1 — $2"; }

echo "== UI-R1-09 Admin AI Runs Gate =="

for f in \
  services/ptt-crm-api/src/ai-intelligence/guards/staff-ai-admin.guard.ts \
  services/ops-web/src/components/ai/AdminAiRunsPanel.tsx \
  services/ops-web/src/app/admin/ai/runs/page.tsx \
  services/ops-web/e2e/admin-ai-runs-ui-r1-09.spec.ts \
  scripts/playwright_ops_admin_ai_runs_e2e.sh; do
  if [[ -f "$ROOT/$f" ]]; then
    log_ok "artifact-${f//\//-}" "Present"
  else
    log_fail "artifact-${f//\//-}" "Missing $f"
  fi
done

if grep -q 'StaffAiAdminGuard' "$ROOT/services/ptt-crm-api/src/ai-intelligence/ai-intelligence.controller.ts"; then
  log_ok "api-guard" "StaffAiAdminGuard on ai/runs routes"
else
  log_fail "api-guard" "Missing StaffAiAdminGuard on list/get runs"
fi

if grep -q 'fetchAiAgentRuns' "$ROOT/services/ops-web/src/lib/ai-api.ts"; then
  log_ok "api-client" "fetchAiAgentRuns in ai-api.ts"
else
  log_fail "api-client" "Missing fetchAiAgentRuns"
fi

if grep -q "section: 'ai_admin'" "$ROOT/services/ptt-crm-api/src/staff-auth/staff-auth.service.ts"; then
  log_ok "rbac-cap" "ai_admin.view in stub caps"
else
  log_fail "rbac-cap" "Missing ai_admin cap"
fi

if grep -q '/admin/ai/runs' "$ROOT/services/ops-web/src/components/OpsNav.tsx"; then
  log_ok "ops-nav" "Admin AI runs nav link"
else
  log_fail "ops-nav" "Missing OpsNav link"
fi

if grep -q 'admin-ai-runs-panel' "$ROOT/services/ops-web/src/app/globals.css"; then
  log_ok "css-panel" "admin-ai-runs styles present"
else
  log_fail "css-panel" "Missing admin AI runs CSS"
fi

if grep -q 'test:e2e:admin-ai-runs' "$ROOT/services/ops-web/package.json"; then
  log_ok "npm-script" 'test:e2e:admin-ai-runs in package.json'
else
  log_fail "npm-script" 'Add test:e2e:admin-ai-runs script'
fi

echo "==> ptt-crm-api unit tests (staff-ai-admin.guard)"
if (cd "$ROOT/services/ptt-crm-api" && npm test -- staff-ai-admin.guard.spec.ts --passWithNoTests 2>/dev/null); then
  log_ok "api-unit" "staff-ai-admin.guard.spec.ts PASS"
else
  log_fail "api-unit" "Guard unit tests failed"
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

if bash "$ROOT/scripts/playwright_ops_admin_ai_runs_e2e.sh"; then
  log_ok "playwright-e2e" "admin-ai-runs-ui-r1-09.spec.ts PASS"
else
  log_fail "playwright-e2e" "Playwright UI-R1-09 E2E failed"
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
  "rnos": "UI-R1-09",
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
