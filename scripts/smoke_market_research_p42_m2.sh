#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PAGE="$ROOT/services/ops-web/src/app/crm/research/[id]/page.tsx"
COMP="$ROOT/services/ops-web/src/components/research/ReportStaleInsightList.tsx"
grep -q 'ReportStaleInsightList' "$PAGE"
grep -q 'staff-report-stale-list' "$COMP"
grep -q 'staff-report-stale-row-' "$COMP"
echo "OK  P42 M2 ReportStaleInsightList wired"
