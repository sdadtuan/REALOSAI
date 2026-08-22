#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
grep -q 'listPublishedEmbeddings' "$ROOT/services/ptt-crm-api/src/portal-research/portal-research.repository.ts"
grep -q 'insights/search' "$ROOT/services/ptt-crm-api/src/portal-research/portal-research.controller.ts"
cd "$ROOT/services/ptt-crm-api"
npx jest src/portal-research/portal-research.repository.spec.ts src/portal-research/portal-research.service.spec.ts -t "P12 portal RAG" --verbose --no-coverage
echo "OK  P12 M2 portal search API + tenancy"
