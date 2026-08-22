#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/services/ptt-crm-api"
npx jest src/portal-research/portal-research.service.spec.ts --testNamePattern='P47|listReports stale_only' --verbose --no-coverage
echo "OK  P47 M1 portal listReports stale_only unit tests"
