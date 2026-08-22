#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/services/ptt-crm-api"
npx jest src/market-research/conjoint-lite.util.spec.ts --verbose --no-coverage
echo "OK  P21 M1 conjoint util"
