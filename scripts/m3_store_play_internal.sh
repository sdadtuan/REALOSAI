#!/usr/bin/env bash
# RNOS-M3 Phase 2 — Upload Android AAB to Play Internal Testing
#   bash scripts/m3_store_play_internal.sh
#
# Requires:
#   GOOGLE_PLAY_JSON_KEY_PATH — Play Console service account JSON
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SHELL_DIR="$ROOT/services/mobile-shell"

if [[ -f "$SHELL_DIR/.env.local" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$SHELL_DIR/.env.local"
  set +a
fi

echo "== RNOS-M3 Play Internal Testing upload =="

if [[ -z "${GOOGLE_PLAY_JSON_KEY_PATH:-}" ]]; then
  echo "FAIL  Missing GOOGLE_PLAY_JSON_KEY_PATH"
  echo "      Play Console → Setup → API access → service account JSON"
  echo "      See services/mobile-shell/fastlane/README.md"
  exit 1
fi

if [[ ! -f "$GOOGLE_PLAY_JSON_KEY_PATH" ]]; then
  echo "FAIL  File not found: $GOOGLE_PLAY_JSON_KEY_PATH"
  exit 1
fi

echo "==> Sync Capacitor shell"
bash "$ROOT/scripts/m3_mobile_shell_sync.sh"

echo "==> Patch Android (intent filters, google-services if present)"
bash "$ROOT/scripts/m3_mobile_shell_patch_native.sh"

if [[ ! -f "$SHELL_DIR/android/app/google-services.json" ]]; then
  echo "WARN  android/app/google-services.json missing — FCM push disabled until added"
  echo "      Copy from resources/firebase/ template"
fi

if command -v bundle >/dev/null 2>&1 && [[ -f "$SHELL_DIR/Gemfile" ]]; then
  (cd "$SHELL_DIR" && bundle exec fastlane android internal)
else
  (cd "$SHELL_DIR" && fastlane android internal)
fi

echo ""
echo "OK  AAB uploaded to Internal Testing track (draft)"
echo "    Play Console → Release → Testing → Internal testing → promote + add testers"
echo "    Review notes: docs/templates/m3-app-store-review-notes.md"
