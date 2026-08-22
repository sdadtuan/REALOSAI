#!/usr/bin/env bash
# Point xcode-select to full Xcode (required for cap sync ios / simctl)
#   bash scripts/m3_mobile_shell_xcode_select.sh
set -euo pipefail

XCODE_APP="/Applications/Xcode.app/Contents/Developer"

if [[ ! -d "$XCODE_APP" ]]; then
  echo "FAIL  Xcode.app not found — install from App Store"
  echo "      https://apps.apple.com/app/xcode/id497799835"
  exit 1
fi

echo "Current developer dir:"
xcode-select -p

echo "==> sudo xcode-select -s $XCODE_APP"
sudo xcode-select -s "$XCODE_APP"

echo "==> accept license (if prompted)"
sudo xcodebuild -license accept 2>/dev/null || true

echo "==> verify"
xcodebuild -version
xcrun simctl list devices available 2>&1 | head -8

echo ""
echo "Next:"
echo "  cd services/mobile-shell && npx cap sync ios"
echo "  bash scripts/m3_mobile_shell_patch_native.sh"
echo "  npm run cap:open:ios"
