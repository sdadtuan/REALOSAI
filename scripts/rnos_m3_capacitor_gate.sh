#!/usr/bin/env bash
# RNOS-M3 Phase 2 — Full Capacitor gate (artifacts + builds + deep link smoke)
#   bash scripts/rnos_m3_capacitor_gate.sh
#
# Env:
#   SKIP_IOS_BUILD=1       skip xcodebuild
#   SKIP_ANDROID_BUILD=1   skip gradle assembleDebug
#   RUN_DEEPLINK_SMOKE=1   require simctl/adb deep link (Phase 2 strict)
#   REPORT=path            JSON report output
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
REPORT="${REPORT:-$ROOT/.local-dev/rnos-m3-capacitor-gate-report.json}"
SHELL_DIR="$ROOT/services/mobile-shell"
IOS_WORKSPACE="$SHELL_DIR/ios/App/App.xcworkspace"
ANDROID_DIR="$SHELL_DIR/android"
DERIVED_DATA="${DERIVED_DATA:-/tmp/rnos-m3-capacitor-gate-dd}"
pass=0
fail=0
results=()

if [[ -d /Applications/Xcode.app/Contents/Developer ]]; then
  export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer
fi

log_ok() { pass=$((pass + 1)); results+=("{\"id\":\"$1\",\"status\":\"pass\",\"detail\":$(python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$2")}"); echo "PASS  $1 — $2"; }
log_fail() { fail=$((fail + 1)); results+=("{\"id\":\"$1\",\"status\":\"fail\",\"detail\":$(python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$2")}"); echo "FAIL  $1 — $2"; }
log_skip() { results+=("{\"id\":\"$1\",\"status\":\"skip\",\"detail\":$(python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$2")}"); echo "SKIP  $1 — $2"; }

_write_report() {
  mkdir -p "$(dirname "$REPORT")"
  local tmp
  tmp="$(mktemp)"
  printf '%s\n' "${results[@]}" > "$tmp"
  python3 - <<PY
import json, datetime
from pathlib import Path
lines = [l for l in Path("$tmp").read_text().splitlines() if l.strip()]
checks = [json.loads(l) for l in lines]
report = {
  "generated_at": datetime.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
  "rnos": "RNOS-M3",
  "phase": "2-store-prep-gate",
  "summary": {"pass": $pass, "fail": $fail},
  "checks": checks,
}
Path("$REPORT").write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\\n")
PY
  rm -f "$tmp"
}

trap '_write_report' EXIT

echo "== RNOS-M3 Capacitor Gate (Phase 2 QA + store prep) =="

# --- Artifacts (M3 backend + shell) ---
for f in \
  services/mobile-shell/capacitor.config.ts \
  services/mobile-shell/src/shell-bootstrap.ts \
  services/mobile-shell/src/deep-link.ts \
  services/mobile-shell/scripts/patch-native-config.mjs \
  services/portal-web/src/components/capacitor/CapacitorShellInit.tsx \
  services/portal-web/src/lib/capacitorDeepLink.ts \
  services/ptt-crm-api/src/portal/portal-mobile.controller.ts \
  docs/specs/ddl-portal-native-device-tokens.sql \
  docs/runbooks/m3-phase2-store-prep-checklist.md \
  docs/templates/m3-app-store-review-notes.md \
  scripts/m3_store_screenshots_capture.sh \
  scripts/m3_store_testflight_upload.sh \
  scripts/m3_store_play_internal.sh; do
  if [[ -f "$ROOT/$f" ]]; then
    log_ok "artifact-${f//\//-}" "Present"
  else
    log_fail "artifact-${f//\//-}" "Missing $f"
  fi
done

if grep -q 'PortalMobileController' "$ROOT/services/ptt-crm-api/src/portal/portal.module.ts"; then
  log_ok "nest-module-wire" "PortalMobileController wired"
else
  log_fail "nest-module-wire" "Missing PortalMobile* in portal.module"
fi

if [[ -x "$ROOT/scripts/m3_mobile_shell_patch_native.sh" ]]; then
  log_ok "patch-native-script" "m3_mobile_shell_patch_native.sh executable"
else
  log_fail "patch-native-script" "chmod +x m3_mobile_shell_patch_native.sh"
fi

# --- Backend gate ---
echo ""
echo "==> M3 backend gate"
if bash "$ROOT/scripts/rnos_m3_backend_gate.sh" >/tmp/rnos-m3-cap-backend.log 2>&1; then
  log_ok "backend-gate" "rnos_m3_backend_gate PASS"
else
  log_fail "backend-gate" "See /tmp/rnos-m3-cap-backend.log"
fi

# --- Phase 1 shell gate (no recursive backend call) ---
echo ""
echo "==> Phase 1 shell gate"
if M3_SKIP_BACKEND_GATE=1 bash "$ROOT/scripts/rnos_m3_phase1_gate.sh" >/tmp/rnos-m3-cap-gate-p1.log 2>&1; then
  log_ok "phase1-gate" "rnos_m3_phase1_gate PASS"
else
  log_fail "phase1-gate" "See /tmp/rnos-m3-cap-gate-p1.log"
fi

# --- mobile-shell bootstrap ---
echo ""
echo "==> mobile-shell build:www"
if (cd "$SHELL_DIR" && npm install --no-audit --no-fund >/tmp/rnos-m3-cap-shell-npm.log 2>&1 && npm run build:www >/tmp/rnos-m3-cap-shell-build.log 2>&1); then
  log_ok "shell-build-www" "shell-bootstrap.js OK"
else
  log_fail "shell-build-www" "See /tmp/rnos-m3-cap-shell-build.log"
fi

# --- iOS build ---
echo ""
if [[ "${SKIP_IOS_BUILD:-0}" == "1" ]]; then
  log_skip "ios-build" "SKIP_IOS_BUILD=1"
elif [[ ! -d "$IOS_WORKSPACE" ]]; then
  log_fail "ios-build" "Missing ios/App — run m3_mobile_shell_init.sh"
else
  echo "==> iOS xcodebuild (Simulator Debug)"
  SIM_NAME="${IOS_SIM_NAME:-iPhone 17 Pro}"
  if xcodebuild -workspace "$IOS_WORKSPACE" -scheme App -configuration Debug \
    -destination "platform=iOS Simulator,name=${SIM_NAME}" \
    -derivedDataPath "$DERIVED_DATA" build \
    >/tmp/rnos-m3-cap-ios-build.log 2>&1; then
    log_ok "ios-build" "xcodebuild OK (${SIM_NAME})"
  else
    log_fail "ios-build" "See /tmp/rnos-m3-cap-ios-build.log"
  fi
fi

# --- Android build ---
echo ""
if [[ "${SKIP_ANDROID_BUILD:-0}" == "1" ]]; then
  log_skip "android-build" "SKIP_ANDROID_BUILD=1"
elif [[ ! -d "$ANDROID_DIR" ]]; then
  log_fail "android-build" "Missing android/ — run m3_mobile_shell_init.sh"
else
  echo "==> Android assembleDebug"
  if (cd "$ANDROID_DIR" && ./gradlew :app:assembleDebug --no-daemon >/tmp/rnos-m3-cap-android-build.log 2>&1); then
    log_ok "android-build" "assembleDebug OK"
  else
    log_fail "android-build" "See /tmp/rnos-m3-cap-android-build.log"
  fi
fi

# --- Deep link smoke ---
echo ""
echo "==> Deep link smoke (pttads://approve/{uuid})"
if bash "$ROOT/scripts/m3_mobile_shell_deeplink_test.sh" >/tmp/rnos-m3-cap-deeplink.log 2>&1; then
  log_ok "deeplink-smoke" "simctl/adb openurl sent"
else
  if [[ "${RUN_DEEPLINK_SMOKE:-0}" == "1" ]]; then
    log_fail "deeplink-smoke" "Required — boot Simulator or connect adb device"
  else
    log_skip "deeplink-smoke" "No device (set RUN_DEEPLINK_SMOKE=1 for Phase 2 strict)"
  fi
fi

# --- Store assets manifest ---
echo ""
if [[ -f "$ROOT/services/mobile-shell/store-assets/screenshots/manifest.json" ]]; then
  log_ok "screenshots-manifest" "store-assets/screenshots/manifest.json"
else
  log_fail "screenshots-manifest" "Run m3_store_screenshots_capture.sh"
fi

if [[ -f "$ROOT/docs/templates/m3-app-store-review-notes.md" ]] \
  && grep -q 'arbitrary URL navigation' "$ROOT/docs/templates/m3-app-store-review-notes.md"; then
  log_ok "review-notes" "App Review notes template present"
else
  log_fail "review-notes" "Missing m3-app-store-review-notes.md"
fi

echo ""
echo "== Summary: $pass pass / $fail fail =="
echo "    Report: $REPORT"
[[ "$fail" -eq 0 ]]
