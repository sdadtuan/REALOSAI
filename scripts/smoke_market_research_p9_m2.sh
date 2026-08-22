#!/usr/bin/env bash
# P9 M2 — unit tests TS collect/client/mapper + pytest sparktoro.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

cd "$ROOT/services/ptt-crm-api"
npx jest src/market-research/sparktoro-client.util.spec.ts \
  src/market-research/sparktoro-collect.spec.ts \
  src/market-research/sparktoro-mapper.util.spec.ts --passWithNoTests --no-coverage

cd "$ROOT"
python3 -m pytest tests/test_research_sparktoro.py -q
echo "OK  P9 M2 sparktoro unit tests"
