#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/services/ptt-crm-api"
npx jest src/portal-research/portal-research.service.spec.ts --testNamePattern='P41|listReports' --verbose --no-coverage
echo "OK  P41 M1 listReports stale badge service"
