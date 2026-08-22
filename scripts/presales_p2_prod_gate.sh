#!/usr/bin/env bash
# S4 — Presales P2 prod hardening gate (E1–E5 + batch rollout readiness).
#
#   ./scripts/presales_p2_prod_gate.sh
#   OPS_E2E_SKIP_SERVER=0 ./scripts/presales_p2_prod_gate.sh   # full Playwright
#
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
fail=0
ok() { echo "OK  $*"; }
bad() { echo "FAIL $*"; fail=1; }
skip() { echo "SKIP $*"; }

echo "== Presales P2 prod gate (S4) =="

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

run_gate "presales_template_upgrade_gate.sh" "S1 template + lifecycle gate"
run_gate "presales_funnel_metrics_gate.sh" "S3 funnel metrics gate"

echo ""
echo "-- Unit specs (consult tab + batch) --"
if (cd "$ROOT/services/ptt-crm-api" && npm test -- \
  --testPathPattern='presales-funnel-metrics|presales-workflow-batch' --silent 2>/dev/null); then
  ok "Nest presales batch/metrics jest"
else
  bad "Nest presales batch/metrics jest"
fi

if (cd "$ROOT/services/ops-web" && npm run test:unit -- src/lib/crm/lead-consult-tab.util.spec.ts --run 2>/dev/null); then
  ok "ops-web consult tab util"
else
  bad "ops-web consult tab util"
fi

echo ""
echo "-- S4 docs & artifacts --"
for f in \
  docs/runbooks/presales-p2-prod-batch-runbook.md \
  docs/templates/presales-p2-am-signoff.md \
  docs/runbooks/presales-p2-am-training.md \
  services/ops-web/src/components/PresalesFunnelMetricsCard.tsx \
  services/ops-web/src/components/LeadConsultWorkspace.tsx \
  services/ops-web/e2e/consult-workspace.spec.ts; do
  if [[ -f "$ROOT/$f" ]]; then
    ok "$f"
  else
    bad "missing $f"
  fi
done

if grep -q "presales_p2_prod_gate" "$ROOT/docs/runbooks/consult-stage-am-sop.md" 2>/dev/null; then
  ok "SOP links S4 gate"
else
  bad "SOP missing S4 gate reference"
fi

if grep -q "PTT_PRESALES_BATCH_UPGRADE" "$ROOT/docs/runbooks/presales-p2-prod-batch-runbook.md" 2>/dev/null; then
  ok "runbook documents batch kill switch"
else
  bad "runbook missing PTT_PRESALES_BATCH_UPGRADE"
fi

if grep -q 'test:e2e:consult-workspace' "$ROOT/services/ops-web/package.json" 2>/dev/null; then
  ok "npm test:e2e:consult-workspace"
else
  bad "missing npm test:e2e:consult-workspace"
fi

echo ""
echo "-- Live API probes (optional) --"
if [[ "${PRESALES_P2_SKIP_API:-1}" == "1" ]]; then
  skip "API UAT — set PRESALES_P2_SKIP_API=0 + stack for consult_phase3_pilot_uat"
else
  if bash "$ROOT/scripts/consult_phase3_pilot_uat.sh"; then
    ok "consult_phase3_pilot_uat"
  else
    bad "consult_phase3_pilot_uat"
  fi
fi

echo ""
echo "-- Playwright consult workspace (optional) --"
if [[ "${OPS_E2E_SKIP_SERVER:-1}" == "1" ]]; then
  skip "playwright — OPS_E2E_SKIP_SERVER=1 (set 0 + stack for full run)"
else
  if bash "$ROOT/scripts/playwright_ops_consult_workspace_e2e.sh"; then
    ok "consult workspace e2e"
  else
    bad "consult workspace e2e"
  fi
fi

echo ""
if [[ "$fail" -eq 0 ]]; then
  echo '{"gate":"presales_p2_prod","ok":true}'
  echo "Presales P2 prod gate PASSED"
  exit 0
fi
echo '{"gate":"presales_p2_prod","ok":false}'
echo "Presales P2 prod gate FAILED"
exit 1
