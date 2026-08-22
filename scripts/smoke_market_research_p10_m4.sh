#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
API="$ROOT/services/ops-web/src/lib/market-research-api.ts"
PAGE="$ROOT/services/ops-web/src/app/crm/research/[id]/page.tsx"
UTIL="$ROOT/services/ops-web/src/components/research/qualtrics-run.util.ts"
CHIP="$ROOT/services/ops-web/src/components/research/ResearchJobChip.tsx"

grep -q 'study_id: number' "$API"
grep -q 'run-qualtrics' "$API"
grep -q 'qualtricsRunId' "$PAGE"
grep -q 'kind="qualtrics"' "$PAGE"
grep -q 'qualtricsRunnableStudies' "$UTIL"
grep -q "'qualtrics'" "$CHIP"
echo "OK  P10 M4 FE qualtrics study_id + chip"
