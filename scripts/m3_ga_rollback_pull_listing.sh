#!/usr/bin/env bash
# RNOS-M3 Phase 4 — Rollback Option B: pull public store listing
#   bash scripts/m3_ga_rollback_pull_listing.sh [--checklist-only]
#
# Manual steps — requires App Store Connect + Play Console org access.
set -euo pipefail

echo "== RNOS-M3 rollback Option B — pull store listing =="
echo ""
echo "App: PTT Portal (vn.pttads.portal)"
echo "Audience: B2B client approver — stop NEW installs only"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "APPLE APP STORE CONNECT"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "1. https://appstoreconnect.apple.com → Apps → PTT Portal"
echo "2. Pricing and Availability → remove countries OR"
echo "   App Information → Remove App from Sale (org policy permitting)"
echo "3. Alternatively: retract pending version under App Store → Version"
echo "4. Notify AM: existing installs may continue — combine with Option A:"
echo "   bash scripts/m3_ga_rollback_min_version_block.sh --apply --min-version 9.9.9"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "GOOGLE PLAY CONSOLE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "1. Play Console → PTT Portal → Release → Production"
echo "2. Halt rollout / Pause staged rollout"
echo "3. (Optional) Deactivate latest production release"
echo "4. Internal comms: support@pttads.vn + AM champion"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "POST-ROLLBACK"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "- Document incident in .local-dev/m3-ga-incident.json"
echo "- Root cause → hotfix portal-web and/or new store binary"
echo "- Re-release: bash scripts/m3_store_ga_release_ios.sh"
echo "                 bash scripts/m3_store_ga_release_android.sh"
echo ""
echo "See: docs/runbooks/m3-phase4-ga-store-checklist.md §4.3"
