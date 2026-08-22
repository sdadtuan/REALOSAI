#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
grep -q 'PORTAL_RAG_BANNER' "$ROOT/services/portal-web/src/lib/portal-research-rag.util.ts"
grep -q 'portalResearchInsightSearch' "$ROOT/services/portal-web/src/lib/api.ts"
grep -q 'PortalResearchRagSearch' "$ROOT/services/portal-web/src/app/research/page.tsx"
! grep -q '/crm/research' "$ROOT/services/portal-web/src/components/PortalResearchRagSearch.tsx"
cd "$ROOT/services/portal-web"
npx tsc --noEmit
echo "OK  P12 M4 portal-web search UI"
