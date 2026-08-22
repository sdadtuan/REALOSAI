#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/services/ptt-crm-api"
npx jest src/portal-research/portal-research.repository.spec.ts --testNamePattern='P15 getThemeQuarterAnalytics' --verbose --no-coverage
echo "OK  P15 M1 portal repo theme quarter SQL"
