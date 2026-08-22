#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
grep -q 'resolveQueryVec' "$ROOT/services/ptt-crm-api/src/portal-research/portal-research.service.ts"
grep -q 'rag_skipped_pii' "$ROOT/services/ptt-crm-api/src/market-research/market-research.types.ts"
cd "$ROOT/services/ptt-crm-api"
npx jest src/portal-research/portal-research.service.spec.ts -t "health rag_enabled|PII query|embed live" --verbose --no-coverage
echo "OK  P12 M3 embed/PII + portal health"
