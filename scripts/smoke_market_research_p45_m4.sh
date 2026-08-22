#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/services/ops-web"
npm run build 2>&1 | tail -5
echo "OK  P45 M4 ops-web build"
