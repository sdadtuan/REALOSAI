#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/services/ptt-crm-api"
npx jest src/market-research/talkwalker-mapper.util.spec.ts src/market-research/competitor-snapshot.util.spec.ts --testNamePattern='P23' --verbose --no-coverage
echo "OK  P23 M1 talkwalker mapper + competitor P23"
