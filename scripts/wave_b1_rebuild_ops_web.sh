#!/usr/bin/env bash
# Rebuild ops-web only (deploy user — NO systemctl, no polkit prompt).
# Prefer: ./scripts/deploy_ops_web.sh  then  sudo ./scripts/deploy_ops_web.sh --restart
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export RNOSAI_ROOT="$ROOT"
exec "$ROOT/scripts/deploy_ops_web.sh" build
