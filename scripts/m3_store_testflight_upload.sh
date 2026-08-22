#!/usr/bin/env bash
# RNOS-M3 Phase 2 — Upload iOS build to TestFlight (internal testers)
#   bash scripts/m3_store_testflight_upload.sh
#
# Requires (env or .env.local — do not commit):
#   APP_STORE_CONNECT_API_KEY_PATH  — .p8 API key
#   APPLE_TEAM_ID
# Optional:
#   TESTFLIGHT_CHANGELOG="RNOS-M3 build 42"
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SHELL_DIR="$ROOT/services/mobile-shell"

if [[ -f "$SHELL_DIR/.env.local" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$SHELL_DIR/.env.local"
  set +a
fi

echo "== RNOS-M3 TestFlight upload =="

for var in APP_STORE_CONNECT_API_KEY_PATH APPLE_TEAM_ID; do
  if [[ -z "${!var:-}" ]]; then
    echo "FAIL  Missing $var"
    echo "      See services/mobile-shell/fastlane/README.md"
    exit 1
  fi
done

if [[ -d /Applications/Xcode.app/Contents/Developer ]]; then
  export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer
fi

echo "==> Sync Capacitor shell"
bash "$ROOT/scripts/m3_mobile_shell_sync.sh"

echo "==> Patch native (entitlements, deep links)"
bash "$ROOT/scripts/m3_mobile_shell_patch_native.sh"

if command -v bundle >/dev/null 2>&1 && [[ -f "$SHELL_DIR/Gemfile" ]]; then
  (cd "$SHELL_DIR" && bundle exec fastlane ios beta)
else
  echo "==> Fastlane (system gem)"
  (cd "$SHELL_DIR" && fastlane ios beta)
fi

echo ""
echo "OK  Upload initiated — App Store Connect → TestFlight → Internal Testing"
echo "    Add testers: App Store Connect → Users and Access → Internal Testing group"
echo "    Review notes: docs/templates/m3-app-store-review-notes.md"
