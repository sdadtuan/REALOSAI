#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PAGE="$ROOT/services/portal-web/src/app/research/[versionId]/page.tsx"
STAFF="$ROOT/services/ops-web/src/app/crm/research/[id]/page.tsx"
grep -q 'published-valid-to' "$PAGE"
grep -q 'PublishedValidToNote' "$PAGE"
grep -q 'publishedValidToFromRow' "$PAGE"
grep -q 'ReportPublishedValidToList' "$STAFF"
if grep -q 'published_valid_to' "$ROOT/services/portal-web/src/lib/insight-stale.util.ts"; then
  echo "FAIL  stale util must not read published_valid_to"
  exit 1
fi
echo "OK  P33 M3 portal + staff UI wiring"
