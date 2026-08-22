#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PAGE="$ROOT/services/ops-web/src/app/crm/research/[id]/page.tsx"
BADGE="$ROOT/services/ops-web/src/components/research/StaffReportVersionStaleBadge.tsx"
grep -q 'StaffReportVersionStaleBadge' "$PAGE"
grep -q 'staff-report-version-stale-badge' "$BADGE"
grep -q 'staff-report-version-row-' "$PAGE"
echo "OK  P43 M2 version meta stale badge wired"
