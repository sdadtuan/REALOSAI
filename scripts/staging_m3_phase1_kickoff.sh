#!/usr/bin/env bash
# RNOS-M3 Phase 1 kickoff — build shell + gate
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "== RNOS-M3 Phase 1 Capacitor shell kickoff =="

chmod +x "$ROOT/scripts/m3_mobile_shell_init.sh" 2>/dev/null || true
chmod +x "$ROOT/scripts/m3_mobile_shell_sync.sh" 2>/dev/null || true
chmod +x "$ROOT/scripts/rnos_m3_phase1_gate.sh" 2>/dev/null || true

bash "$ROOT/scripts/rnos_m3_phase1_gate.sh"

echo ""
echo "Optional native projects:"
echo "  bash scripts/m3_mobile_shell_init.sh   # cap add ios/android (macOS for iOS)"
echo "Runbook: docs/runbooks/m3-phase1-capacitor-shell-checklist.md"
