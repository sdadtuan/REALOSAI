#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/services/ptt-crm-api"
npm test -- --testPathPattern='portal-research.service.spec' --testNamePattern='P15 portal theme quarter|P17 getThemeQuarterAnalytics' --verbose --no-coverage
echo "OK  P17 M2 portal P15+P17 theme quarter specs"
