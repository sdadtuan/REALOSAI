#!/usr/bin/env bash
# RNOS-M3 Phase 1 — Initialize Capacitor ios/android projects
#   bash scripts/m3_mobile_shell_init.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SHELL_DIR="$ROOT/services/mobile-shell"

echo "== RNOS-M3 mobile-shell init =="
cd "$SHELL_DIR"

if ! command -v node >/dev/null 2>&1; then
  echo "FAIL  node required (>=22)" >&2
  exit 1
fi

npm install
npm run build:www

if [[ ! -d ios ]]; then
  echo "==> npx cap add ios (requires macOS + Xcode + CocoaPods)"
  if command -v pod >/dev/null 2>&1; then
    npx cap add ios || echo "WARN  cap add ios failed — install Xcode from App Store"
  else
    echo "WARN  CocoaPods missing — run: brew install cocoapods && npx cap add ios"
  fi
else
  echo "OK  ios/ already exists"
fi

if [[ ! -d android ]]; then
  echo "==> npx cap add android"
  npx cap add android || echo "WARN  cap add android failed — check Android Studio SDK"
else
  echo "OK  android/ already exists"
fi

export CAPACITOR_PORTAL_URL="${CAPACITOR_PORTAL_URL:-https://portal.pttads.vn}"
echo "==> cap sync (CAPACITOR_PORTAL_URL=$CAPACITOR_PORTAL_URL)"
npx cap sync || echo "WARN  cap sync failed — complete after platform add"

echo "==> patch native deep links + iOS associated domains"
bash "$ROOT/scripts/m3_mobile_shell_patch_native.sh" || echo "WARN  native patch skipped"

echo ""
echo "Firebase / APNs:"
echo "  cp android/app/google-services.json.example → google-services.json (see resources/firebase/FIREBASE-SETUP.md)"
echo "  iOS: GoogleService-Info.plist + Push capability in Xcode after cap add ios"
echo "  cd services/mobile-shell"
echo "  npm run cap:open:ios    # macOS"
echo "  npm run cap:open:android"
echo "  See resources/ios/universal-links.md + resources/android/deep-link-intent-filter.snippet.xml"
