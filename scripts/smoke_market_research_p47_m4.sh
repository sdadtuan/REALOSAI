#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/services/ptt-crm-api"
npm run build 2>&1 | tail -3
cd "$ROOT/services/portal-web"
npm run build 2>&1 | tail -3
echo "OK  P47 M4 api + portal-web build"
