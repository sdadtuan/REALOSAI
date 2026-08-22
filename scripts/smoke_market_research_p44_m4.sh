#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/services/ptt-crm-api"
npm run build 2>&1 | tail -5
cd "$ROOT/services/ops-web"
npm run build 2>&1 | tail -5
echo "OK  P44 M4 api + ops-web build"
