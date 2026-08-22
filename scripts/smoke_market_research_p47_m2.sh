#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PAGE="$ROOT/services/portal-web/src/app/research/page.tsx"
API="$ROOT/services/portal-web/src/lib/api.ts"
CTRL="$ROOT/services/ptt-crm-api/src/portal-research/portal-research.controller.ts"
grep -q 'stale_only' "$API"
grep -q 'loadReports' "$PAGE"
grep -q 'allItems' "$PAGE"
grep -q 'PortalReportsListInput' "$CTRL"
echo "OK  P47 M2 stale_only refetch wired"
