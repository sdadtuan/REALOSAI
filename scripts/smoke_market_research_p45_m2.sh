#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PAGE="$ROOT/services/ops-web/src/app/crm/research/[id]/page.tsx"
UTIL="$ROOT/services/ops-web/src/lib/staff-report-list.util.ts"
grep -q 'staff-report-stale-only-filter' "$PAGE"
grep -q 'filterStaffReportVersionsByStale' "$PAGE"
grep -q 'filterStaffReportVersionsByStale' "$UTIL"
grep -q 'STAFF_REPORT_STALE_ONLY_LABEL' "$UTIL"
echo "OK  P45 M2 stale-only filter wired"
