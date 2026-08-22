#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/services/ptt-crm-api"
npx jest src/portal-research/portal-report-stale.util.spec.ts src/portal-research/portal-research.repository.spec.ts --testNamePattern='P24' --verbose --no-coverage
echo "OK  P24 M1 portal-report-stale util + repo P24"
