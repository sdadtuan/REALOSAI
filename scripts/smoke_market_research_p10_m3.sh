#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/services/ptt-crm-api"
npx jest src/market-research/market-research.service.spec.ts -t qualtrics --verbose
echo "OK  P10 M3 qualtrics service specs"
