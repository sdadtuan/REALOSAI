#!/usr/bin/env bash
# RNOS-M3 Phase 3 kickoff — pilot enterprise gate
#   bash scripts/staging_m3_phase3_kickoff.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "== RNOS-M3 Phase 3 — Pilot enterprise kickoff =="

chmod +x "$ROOT/scripts/rnos_m3_phase3_gate.sh" 2>/dev/null || true
chmod +x "$ROOT/scripts/m3_pilot_"*.sh 2>/dev/null || true

bash "$ROOT/scripts/rnos_m3_phase3_gate.sh"

echo ""
echo "Next steps:"
echo "  1. cp deploy/m3-pilot-cohort.example.json deploy/m3-pilot-cohort.json"
echo "  2. bash scripts/m3_pilot_cohort_validate.sh deploy/m3-pilot-cohort.json"
echo "  3. AM: onboard 3-5 iOS + 3-5 Android from TestFlight/Play Internal"
echo "  4. UAT: docs/templates/m3-pilot-uat-v1-checklist.md"
echo "  5. KPI:  bash scripts/m3_pilot_kpi_collect.sh"
echo ""
echo "Runbook: docs/runbooks/m3-phase3-pilot-enterprise-checklist.md"
