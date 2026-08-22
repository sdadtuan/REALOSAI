#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
grep -q 'delta_qoq_pct' "$ROOT/services/ops-web/src/lib/market-research-api.ts"
grep -q 'deltaQoq' "$ROOT/services/ops-web/src/components/research/ResearchThemeQuarterTable.tsx"
grep -q 'theme-quarter-delta.util' "$ROOT/services/ptt-crm-api/src/market-research/market-research.service.ts"
echo "OK  P16 M3 ops-web delta columns"
