#!/usr/bin/env bash
# RNOS-M3 Phase 1 — cap sync with portal URL
#   CAPACITOR_PORTAL_URL=https://portal-staging.pttads.vn bash scripts/m3_mobile_shell_sync.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SHELL_DIR="$ROOT/services/mobile-shell"
export CAPACITOR_PORTAL_URL="${CAPACITOR_PORTAL_URL:-https://portal.pttads.vn}"

cd "$SHELL_DIR"
npm install
npm run build:www
echo "==> cap sync CAPACITOR_PORTAL_URL=$CAPACITOR_PORTAL_URL"
npx cap sync
echo "OK  mobile-shell synced"
