#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/services/ptt-crm-api"
npx jest src/portal-research/portal-research.service.spec.ts --testNamePattern='P24' --verbose --no-coverage
echo "OK  P24 M2 getReport annotate service"
