#!/usr/bin/env bash
# RNOS-M3 Phase 0 kickoff — KPI collect + gate
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "== RNOS-M3 Phase 0 kickoff =="

chmod +x "$ROOT/scripts/m3_m2_kpi_collect.sh" 2>/dev/null || true
chmod +x "$ROOT/scripts/rnos_m3_phase0_gate.sh" 2>/dev/null || true

if [[ "${SKIP_KPI:-0}" != "1" ]]; then
  bash "$ROOT/scripts/m3_m2_kpi_collect.sh" || echo "WARN  KPI collect skipped/failed (fill report manually)"
fi

bash "$ROOT/scripts/rnos_m3_phase0_gate.sh"

echo ""
echo "Next steps:"
echo "  1. Product → docs/templates/m3-m2-kpi-review-report.md"
echo "  2. Tech lead → docs/specs/adr-mob-04-capacitor-before-rn.md"
echo "  3. DevOps/Legal → docs/templates/m3-store-accounts-checklist.md"
echo "  4. Legal/AM → privacy + metadata templates"
echo "  Runbook → docs/runbooks/m3-phase0-discovery-adr-checklist.md"
