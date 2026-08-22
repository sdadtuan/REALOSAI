#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
grep -q 'RES-UC-089' "$ROOT/docs/specs/modules/RNOSAI-BA-RES-UseCases.md"
grep -q 'P29' "$ROOT/docs/use-cases/12-MARKET-RESEARCH-OS.md"
grep -q 'Walkthrough UAT P29' "$ROOT/docs/use-cases/actions/12-RES-ACTIONS.md"
grep -q 'footerLine' "$ROOT/services/ptt-crm-api/src/market-research/market-research-pdf.util.ts"
grep -q 'listInsightValidToForProject' "$ROOT/services/ptt-crm-api/src/market-research/market-research.repository.ts"
test -f "$ROOT/scripts/deploy_market_research_p29_vps.sh"
echo "OK  P29 M4 docs + deploy + wiring"
