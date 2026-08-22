#!/usr/bin/env bash
# RNOS-M3 — Post-Xcode install: cap sync ios + native patch
# Uses DEVELOPER_DIR if xcode-select still points at CLT.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SHELL_DIR="$ROOT/services/mobile-shell"

if [[ -d /Applications/Xcode.app/Contents/Developer ]]; then
  export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer
fi

echo "== RNOS-M3 iOS post-Xcode =="
echo "    DEVELOPER_DIR=${DEVELOPER_DIR:-$(xcode-select -p)}"

if [[ "$(xcode-select -p 2>/dev/null)" == "/Library/Developer/CommandLineTools" ]]; then
  echo "WARN  xcode-select still on CommandLineTools — run once:"
  echo "      sudo xcode-select -s /Applications/Xcode.app/Contents/Developer"
fi

cd "$SHELL_DIR"
npm run build:www
npx cap sync ios
bash "$ROOT/scripts/m3_mobile_shell_patch_native.sh"

echo ""
echo "== verify =="
xcodebuild -version
if xcrun simctl list runtimes 2>/dev/null | grep -q iOS; then
  echo "OK  iOS Simulator runtime installed"
else
  echo "NEXT  Xcode → Settings → Components → install iOS platform (required for Simulator)"
fi

echo ""
echo "Open project: cd services/mobile-shell && npm run cap:open:ios"
