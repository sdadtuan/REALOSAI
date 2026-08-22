#!/usr/bin/env bash
# RNOS-M3 — Test deep link pttads://approve/{uuid}
#   bash scripts/m3_mobile_shell_deeplink_test.sh [creative-uuid]
set -euo pipefail

CREATIVE_ID="${1:-00000000-0000-4000-8000-000000000001}"
URL="pttads://approve/${CREATIVE_ID}"
HTTPS_URL="https://portal.pttads.vn/creatives?focus=${CREATIVE_ID}"

echo "== RNOS-M3 deep link test =="
echo "    Custom:  $URL"
echo "    HTTPS:   $HTTPS_URL"
echo ""

ANDROID_OK=0
IOS_OK=0

if command -v adb >/dev/null 2>&1; then
  DEVICE="$(adb devices | awk 'NR>1 && $2==\"device\" {print $1; exit}')"
  if [[ -n "$DEVICE" ]]; then
    echo "==> Android adb ($DEVICE)"
    adb shell am start -a android.intent.action.VIEW -d "$URL" 2>&1 || true
    echo "    Sent intent — verify app opens /creatives?focus=$CREATIVE_ID"
    ANDROID_OK=1
  else
    echo "WARN  adb: no device/emulator connected (start emulator or plug device)"
  fi
else
  echo "SKIP  adb not in PATH — install Android platform-tools"
fi

if xcrun simctl help >/dev/null 2>&1; then
  BOOTED="$(xcrun simctl list devices booted | grep -E 'Booted' | head -1 || true)"
  if [[ -n "$BOOTED" ]]; then
    echo ""
    echo "==> iOS Simulator (booted)"
    xcrun simctl openurl booted "$URL"
    echo "    Sent openurl — verify app opens creative focus"
    IOS_OK=1
  else
    echo ""
    echo "WARN  iOS Simulator not booted — open Simulator and launch app first"
    echo "      xcrun simctl boot \"iPhone 16\"  # example"
  fi
else
  echo ""
  echo "SKIP  xcrun simctl unavailable — install full Xcode (not only Command Line Tools)"
fi

echo ""
if [[ "$ANDROID_OK" -eq 1 || "$IOS_OK" -eq 1 ]]; then
  echo "OK  deep link command sent — confirm in app UI"
  exit 0
fi

echo "FAIL  no target device — install Xcode/Android SDK and run app once, then retry"
exit 1
