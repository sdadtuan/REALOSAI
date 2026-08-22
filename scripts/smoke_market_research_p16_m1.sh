#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/services/ptt-crm-api"
npx jest src/market-research/theme-quarter-delta.util.spec.ts --verbose --no-coverage
echo "OK  P16 M1 theme quarter delta util"
