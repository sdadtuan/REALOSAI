#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/services/ptt-crm-api"
npx jest src/market-research/qualtrics-client.util.spec.ts \
  src/market-research/qualtrics-to-codebook.util.spec.ts \
  src/market-research/qualtrics-collect.spec.ts --verbose
cd "$ROOT"
python3 -m pytest tests/test_research_qualtrics.py -q
echo "OK  P10 M2 qualtrics jest + pytest"
