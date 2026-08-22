#!/usr/bin/env bash
# RNOS-M3 — Patch Android deep links + iOS Associated Domains
#   bash scripts/m3_mobile_shell_patch_native.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SHELL_DIR="$ROOT/services/mobile-shell"

echo "== RNOS-M3 patch native config =="
cd "$SHELL_DIR"
node scripts/patch-native-config.mjs
echo "OK  native patch complete"
