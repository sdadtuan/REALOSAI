#!/usr/bin/env bash
# E5 — CSKH enterprise sign-off gate (wave E0–E5)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
fail=0
ok() { echo "OK  $*"; }
bad() { echo "FAIL $*"; fail=1; }
skip() { echo "SKIP $*"; }

echo "== E5 CSKH enterprise gate =="

run_gate() {
  local script="$1"
  local label="$2"
  if [[ -x "$ROOT/scripts/$script" ]]; then
    if bash "$ROOT/scripts/$script"; then
      ok "$label"
    else
      bad "$label"
    fi
  else
    bad "missing $script"
  fi
}

run_gate "cskh_board_gate.sh" "Prod-S4 board gate"
run_gate "cskh_e0_home_gate.sh" "E0 home widgets gate"
run_gate "cskh_e2_sla_predict_gate.sh" "E2 SLA predict gate"
run_gate "cskh_e3_handoff_gate.sh" "E3 handoff gate"
run_gate "cskh_e4_playbook_gate.sh" "E4 closed-loop gate"

echo ""
echo "-- Wave jest specs --"
if (cd "$ROOT/services/ptt-crm-api" && npx jest \
  src/cskh-board/sla-predict.util.spec.ts \
  src/cskh-board/cskh-shift-handoff.util.spec.ts \
  src/playbooks/playbook-closed-loop.util.spec.ts \
  src/gdkd-enterprise/gdkd-enterprise-kpi.util.spec.ts \
  --silent 2>/dev/null); then
  ok "wave jest specs"
else
  bad "wave jest specs failed"
fi

echo ""
echo "-- GDKD 8 KPI tiles --"
if grep -q "gate_pass" "$ROOT/services/ptt-crm-api/src/gdkd-enterprise/gdkd-enterprise-kpi.util.ts" 2>/dev/null; then
  ok "gate_pass on KPI tiles"
else
  bad "missing gate_pass on KPI tiles"
fi

if grep -q "GDKD_KPI_TARGETS" "$ROOT/services/ptt-crm-api/src/gdkd-enterprise/gdkd-enterprise-kpi.util.ts" 2>/dev/null; then
  ok "GDKD_KPI_TARGETS defined"
else
  bad "missing GDKD_KPI_TARGETS"
fi

echo ""
echo "-- E5 docs & E2E artifacts --"
for f in \
  docs/huong-dan-cskh-enterprise-ops.md \
  docs/runbooks/cskh-enterprise-ops-runbook.md \
  docs/templates/cskh-enterprise-e5-signoff.md \
  services/ops-web/e2e/home-cskh-widgets.spec.ts; do
  if [[ -f "$ROOT/$f" ]]; then
    ok "$f"
  else
    bad "missing $f"
  fi
done

if grep -q "cskh-enterprise-ops-runbook" "$ROOT/docs/runbooks/cskh-spa-lead-meta-24h-sop.md" 2>/dev/null; then
  ok "SOP links enterprise runbook"
else
  bad "SOP missing enterprise runbook link"
fi

if grep -q 'test:e2e:home-cskh-widgets' "$ROOT/services/ops-web/package.json" 2>/dev/null; then
  ok "npm test:e2e:home-cskh-widgets"
else
  bad "missing npm test:e2e:home-cskh-widgets"
fi

echo ""
echo "-- Playwright E2E (optional) --"
if [[ "${OPS_E2E_SKIP_SERVER:-1}" == "1" ]]; then
  skip "playwright E2E — OPS_E2E_SKIP_SERVER=1 (set 0 + stack for full run)"
else
  if bash "$ROOT/scripts/playwright_ops_cskh_enterprise_e5_e2e.sh"; then
    ok "playwright E5 E2E"
  else
    bad "playwright E5 E2E failed"
  fi
fi

if [[ "$fail" -eq 0 ]]; then
  echo ""
  echo "E5 CSKH enterprise gate PASSED"
  exit 0
fi
echo ""
echo "E5 CSKH enterprise gate FAILED"
exit 1
