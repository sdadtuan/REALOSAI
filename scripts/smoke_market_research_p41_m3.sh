#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SERVICE="$ROOT/services/ptt-crm-api/src/portal-research/portal-research.service.ts"
PAGE="$ROOT/services/portal-web/src/app/research/page.tsx"
TYPES="$ROOT/services/ptt-crm-api/src/market-research/market-research.types.ts"
grep -q 'has_stale_insights' "$SERVICE"
grep -q 'reportSnapshotHasStaleInsights' "$SERVICE"
grep -q 'has_stale_insights' "$TYPES"
grep -q 'portal-report-stale-badge' "$PAGE"
grep -q 'portal-report-list-row-' "$PAGE"
echo "OK  P41 M3 list stale gates + portal badge testids"
