#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
grep -q 'governance/iso-gap' "$ROOT/services/ptt-crm-api/src/market-research/market-research.controller.ts"
grep -q 'getIsoGapCheck' "$ROOT/services/ptt-crm-api/src/market-research/market-research.service.ts"
grep -q 'iso-gap-panel' "$ROOT/services/ops-web/src/components/research/ResearchIsoGapPanel.tsx"
grep -q 'fetchResearchIsoGap' "$ROOT/services/ops-web/src/lib/market-research-api.ts"
grep -q "tab === 'governance'" "$ROOT/services/ops-web/src/app/crm/research/[id]/page.tsx"
echo "OK  P37 M3 API route + ops-web ISO gap panel"
