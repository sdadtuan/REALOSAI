#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
grep -q 'delta_qoq_pct' "$ROOT/services/portal-web/src/lib/api.ts"
grep -q 'deltaQoq' "$ROOT/services/portal-web/src/components/PortalThemeQuarterTable.tsx"
grep -q 'enrichThemeQuarterRows' "$ROOT/services/ptt-crm-api/src/portal-research/portal-research.service.ts"
echo "OK  P17 M3 portal-web delta columns"
