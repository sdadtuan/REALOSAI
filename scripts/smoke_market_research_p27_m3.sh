#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
grep -q '!h.is_stale' "$ROOT/services/ptt-crm-api/src/market-research/research-rag.util.ts"
grep -q 'stale_only' "$ROOT/services/ptt-crm-api/src/market-research/research-rag.util.ts"
echo "OK  P27 M3 rankRagHits default exclude stale"
