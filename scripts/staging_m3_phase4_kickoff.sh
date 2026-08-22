#!/usr/bin/env bash
# RNOS-M3 Phase 4 kickoff — GA store gate
#   bash scripts/staging_m3_phase4_kickoff.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "== RNOS-M3 Phase 4 — GA store kickoff =="

chmod +x "$ROOT/scripts/rnos_m3_phase4_gate.sh" 2>/dev/null || true
chmod +x "$ROOT/scripts/m3_store_ga_"*.sh 2>/dev/null || true
chmod +x "$ROOT/scripts/m3_ga_"*.sh 2>/dev/null || true

bash "$ROOT/scripts/rnos_m3_phase4_gate.sh"

echo ""
echo "GA release (requires store secrets):"
echo "  bash scripts/m3_store_ga_release_ios.sh"
echo "  bash scripts/m3_store_ga_release_android.sh"
echo ""
echo "Monitoring:"
echo "  bash scripts/m3_ga_sentry_verify.sh"
echo ""
echo "Rollback:"
echo "  bash scripts/m3_ga_rollback_min_version_block.sh --min-version 1.0.1"
echo "  bash scripts/m3_ga_rollback_pull_listing.sh"
echo ""
echo "Runbook: docs/runbooks/m3-phase4-ga-store-checklist.md"
