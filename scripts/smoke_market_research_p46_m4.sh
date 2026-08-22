#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/services/portal-web"
npm run build 2>&1 | tail -5
echo "OK  P46 M4 portal-web build"
