#!/usr/bin/env bash
# RNOS-M3 Phase 4 — Submit iOS production release (App Store GA)
#   bash scripts/m3_store_ga_release_ios.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SHELL_DIR="$ROOT/services/mobile-shell"

if [[ -f "$SHELL_DIR/.env.local" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$SHELL_DIR/.env.local"
  set +a
fi

echo "== RNOS-M3 iOS GA release (PTT Portal) =="

for var in APP_STORE_CONNECT_API_KEY_PATH APPLE_TEAM_ID; do
  if [[ -z "${!var:-}" ]]; then
    echo "FAIL  Missing $var — see services/mobile-shell/fastlane/README.md"
    exit 1
  fi
done

if [[ -d /Applications/Xcode.app/Contents/Developer ]]; then
  export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer
fi

bash "$ROOT/scripts/m3_mobile_shell_sync.sh"
bash "$ROOT/scripts/m3_mobile_shell_patch_native.sh"

export GA_RELEASE_CHANGELOG="${GA_RELEASE_CHANGELOG:-PTT Portal GA — client approver B2B}"

if command -v bundle >/dev/null 2>&1 && [[ -f "$SHELL_DIR/Gemfile" ]]; then
  (cd "$SHELL_DIR" && bundle exec fastlane ios release)
else
  (cd "$SHELL_DIR" && fastlane ios release)
fi

echo ""
echo "OK  iOS build uploaded — complete App Store Connect review + release"
echo "    Rollback: bash scripts/m3_ga_rollback_pull_listing.sh"
