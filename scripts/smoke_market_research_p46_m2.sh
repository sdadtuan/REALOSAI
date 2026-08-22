#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PAGE="$ROOT/services/portal-web/src/app/research/page.tsx"
UTIL="$ROOT/services/portal-web/src/lib/portal-report-list.util.ts"
grep -q 'portal-report-stale-only-filter' "$PAGE"
grep -q 'filterPortalReportCardsByStale' "$PAGE"
grep -q 'filterPortalReportCardsByStale' "$UTIL"
grep -q 'PORTAL_REPORT_STALE_ONLY_LABEL' "$UTIL"
echo "OK  P46 M2 stale-only filter wired"
