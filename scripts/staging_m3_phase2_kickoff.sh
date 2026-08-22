#!/usr/bin/env bash
# RNOS-M3 Phase 2 kickoff — QA gate + store prep artifacts
#   bash scripts/staging_m3_phase2_kickoff.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "== RNOS-M3 Phase 2 — QA & Store prep kickoff =="

chmod +x "$ROOT/scripts/rnos_m3_capacitor_gate.sh" 2>/dev/null || true
chmod +x "$ROOT/scripts/m3_store_screenshots_capture.sh" 2>/dev/null || true
chmod +x "$ROOT/scripts/m3_store_testflight_upload.sh" 2>/dev/null || true
chmod +x "$ROOT/scripts/m3_store_play_internal.sh" 2>/dev/null || true

export RUN_DEEPLINK_SMOKE="${RUN_DEEPLINK_SMOKE:-0}"
export SKIP_IOS_BUILD="${SKIP_IOS_BUILD:-0}"
export SKIP_ANDROID_BUILD="${SKIP_ANDROID_BUILD:-0}"

bash "$ROOT/scripts/rnos_m3_capacitor_gate.sh"

echo ""
echo "Next steps (manual / secrets required):"
echo "  1. Screenshots:  bash scripts/m3_store_screenshots_capture.sh"
echo "  2. TestFlight:   bash scripts/m3_store_testflight_upload.sh"
echo "  3. Play Internal: bash scripts/m3_store_play_internal.sh"
echo "  4. Review notes: docs/templates/m3-app-store-review-notes.md"
echo ""
echo "Runbook: docs/runbooks/m3-phase2-store-prep-checklist.md"
