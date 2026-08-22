#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
grep -q "Get('conjoint')" "$ROOT/services/ptt-crm-api/src/portal-research/portal-research.controller.ts"
grep -q 'portal-conjoint-lite' "$ROOT/services/portal-web/src/components/PortalConjointLite.tsx"
grep -q 'portalResearchConjoint' "$ROOT/services/portal-web/src/lib/api.ts"
! grep -q 'cj-whatif' "$ROOT/services/portal-web/src/components/PortalConjointLite.tsx"
! grep -q 'Tính conjoint' "$ROOT/services/portal-web/src/components/PortalConjointLite.tsx"
echo "OK  P35 M3 GET conjoint + portal block wiring"
