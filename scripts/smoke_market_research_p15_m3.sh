#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
grep -q 'analytics/themes' "$ROOT/services/ptt-crm-api/src/portal-research/portal-research.controller.ts"
grep -q 'portalResearchThemeQuarterAnalytics' "$ROOT/services/portal-web/src/lib/api.ts"
grep -q 'PortalThemeQuarterTable' "$ROOT/services/portal-web/src/app/research/page.tsx"
echo "OK  P15 M3 portal-web theme quarter table"
