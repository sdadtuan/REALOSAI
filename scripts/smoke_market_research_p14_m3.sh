#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
grep -q 'analytics/themes' "$ROOT/services/ptt-crm-api/src/market-research/market-research.controller.ts"
grep -q 'fetchResearchThemeQuarterAnalytics' "$ROOT/services/ops-web/src/lib/market-research-api.ts"
grep -q 'ResearchThemeQuarterTable' "$ROOT/services/ops-web/src/app/crm/research/analytics/page.tsx"
echo "OK  P14 M3 ops-web theme quarter table"
