#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/services/ptt-crm-api"
npx jest src/portal-research/portal-research.service.spec.ts --testNamePattern='P19 searchInsights' --verbose --no-coverage
echo "OK  P19 M2 portal search is_stale"
