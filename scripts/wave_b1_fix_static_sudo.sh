#!/usr/bin/env bash
# Run with sudo (linuxuser/root) — restart ops-web + nginx + verify static.
#   cd /var/www/rnosai && sudo ./scripts/wave_b1_fix_static_sudo.sh
set -euo pipefail

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Usage: sudo $0"
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
exec "$ROOT/scripts/deploy_ops_web.sh" --restart
