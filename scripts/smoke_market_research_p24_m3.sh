#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REPO="$ROOT/services/ptt-crm-api/src/portal-research/portal-research.repository.ts"
SERVICE="$ROOT/services/ptt-crm-api/src/portal-research/portal-research.service.ts"
PAGE="$ROOT/services/portal-web/src/app/research/[versionId]/page.tsx"
grep -q 'listPublishedInsightValidTo' "$REPO"
grep -q 'annotatePortalReportRow' "$SERVICE"
grep -q 'PortalInsightStaleBanner' "$PAGE"
if awk '/async exportReportPdf\(/,0' "$SERVICE" | grep -q 'annotatePortalReportRow'; then
  echo "FAIL  exportReportPdf calls annotatePortalReportRow"
  exit 1
fi
echo "OK  P24 M3 annotate gates + PDF unchanged"
