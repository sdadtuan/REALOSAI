#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
grep -q 'is_stale' "$ROOT/services/portal-web/src/lib/api.ts"
grep -q 'PortalInsightStaleBanner' "$ROOT/services/portal-web/src/components/PortalResearchRagSearch.tsx"
grep -q 'i\.valid_to' "$ROOT/services/ptt-crm-api/src/portal-research/portal-research.repository.ts"
echo "OK  P19 M3 portal-web + repository valid_to"
