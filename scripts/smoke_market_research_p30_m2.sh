#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
grep -q 'parseRagStaleOnlyFlag' "$ROOT/services/ptt-crm-api/src/market-research/market-research.service.ts"
grep -q 'stale_only' "$ROOT/services/ptt-crm-api/src/market-research/market-research.controller.ts"
grep -q 'stale_only?: string | boolean' "$ROOT/services/ptt-crm-api/src/market-research/market-research.types.ts"
echo "OK  P30 M2 staff API stale_only wiring"
