#!/usr/bin/env bash
# RNOS-M3 Phase 4 — Submit Android production release (Play Store GA)
#   bash scripts/m3_store_ga_release_android.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SHELL_DIR="$ROOT/services/mobile-shell"

if [[ -f "$SHELL_DIR/.env.local" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$SHELL_DIR/.env.local"
  set +a
fi

echo "== RNOS-M3 Android GA release (PTT Portal) =="

if [[ -z "${GOOGLE_PLAY_JSON_KEY_PATH:-}" ]]; then
  echo "FAIL  Missing GOOGLE_PLAY_JSON_KEY_PATH"
  exit 1
fi

bash "$ROOT/scripts/m3_mobile_shell_sync.sh"
bash "$ROOT/scripts/m3_mobile_shell_patch_native.sh"

export GA_ROLLOUT_FRACTION="${GA_ROLLOUT_FRACTION:-0.1}"

if command -v bundle >/dev/null 2>&1 && [[ -f "$SHELL_DIR/Gemfile" ]]; then
  (cd "$SHELL_DIR" && bundle exec fastlane android production)
else
  (cd "$SHELL_DIR" && fastlane android production)
fi

echo ""
echo "OK  Android AAB uploaded to Production (staged rollout ${GA_ROLLOUT_FRACTION})"
echo "    Rollback: bash scripts/m3_ga_rollback_pull_listing.sh"
