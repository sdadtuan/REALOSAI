#!/usr/bin/env bash
# RNOS-M3 Phase 2 — Capture App Store screenshots (6.7", 5.5", iPad)
#   bash scripts/m3_store_screenshots_capture.sh [--simulator-only]
#
# Playwright mode (default): portal-web E2E @ mobile viewports → PNG in store-assets/
# Simulator mode: boot iOS sim, install app, manual login, then simctl screenshot
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/services/mobile-shell/store-assets/screenshots/ios"
MODE="${1:-playwright}"

mkdir -p "$OUT"

if [[ "$MODE" == "--simulator-only" ]]; then
  echo "== RNOS-M3 iOS Simulator screenshot capture =="
  if [[ -d /Applications/Xcode.app/Contents/Developer ]]; then
    export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer
  fi

  capture_sim() {
    local name="$1" label="$2"
    echo "==> $label ($name)"
    xcrun simctl shutdown all 2>/dev/null || true
    xcrun simctl boot "$name" 2>/dev/null || xcrun simctl boot "$name"
    sleep 3
    xcrun simctl io booted screenshot "$OUT/sim-${label}-frame.png"
    echo "    Saved sim-${label}-frame.png — navigate app manually, re-run for each screen"
  }

  capture_sim "iPhone 17 Pro Max" "iphone-6.7"
  capture_sim "iPhone 8 Plus" "iphone-5.5" || echo "WARN  iPhone 8 Plus runtime missing — use Playwright + sips resize"
  capture_sim "iPad Pro 13-inch (M5)" "ipad-13"
  exit 0
fi

echo "== RNOS-M3 Playwright store screenshots =="
echo "    Output: $OUT"
echo "    Requires portal-web + API (Playwright webServer) or PORTAL_E2E_SKIP_SERVER=1 + running stack"
echo ""

export M3_SCREENSHOT_OUT_DIR="$OUT"
export PORTAL_E2E_SKIP_SERVER="${PORTAL_E2E_SKIP_SERVER:-1}"
export PORTAL_E2E_URL="${PORTAL_E2E_URL:-http://127.0.0.1:3100}"
export PORTAL_E2E_API_URL="${PORTAL_E2E_API_URL:-http://127.0.0.1:3000}"
export PORTAL_E2E_APPROVER_EMAIL="${PORTAL_E2E_APPROVER_EMAIL:-approver@demo.local}"
export PORTAL_E2E_APPROVER_PASSWORD="${PORTAL_E2E_APPROVER_PASSWORD:-demo123}"

(cd "$ROOT/services/portal-web" && npx playwright test e2e/store-screenshots-m3.spec.ts --project=chromium)

# Resize to exact App Store pixel dimensions (optional polish)
resize_if_sips() {
  local src="$1" w="$2" h="$3"
  if command -v sips >/dev/null 2>&1 && [[ -f "$src" ]]; then
    sips -z "$h" "$w" "$src" >/dev/null
  fi
}

for f in "$OUT"/iphone-6.7-*.png; do
  [[ -f "$f" ]] || continue
  resize_if_sips "$f" 1290 2796
done
for f in "$OUT"/iphone-5.5-*.png; do
  [[ -f "$f" ]] || continue
  resize_if_sips "$f" 1242 2208
done
for f in "$OUT"/ipad-13-*.png; do
  [[ -f "$f" ]] || continue
  resize_if_sips "$f" 2064 2752
done

echo ""
echo "OK  Screenshots in $OUT"
echo "    Upload to App Store Connect / Play Console per manifest.json"
ls -la "$OUT"/*.png 2>/dev/null || echo "WARN  No PNG files — check Playwright login credentials"
