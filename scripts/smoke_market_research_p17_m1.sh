#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/services/ptt-crm-api"
npm test -- --testPathPattern='portal-research.service.spec' --testNamePattern='P17 getThemeQuarterAnalytics' --verbose --no-coverage
echo "OK  P17 M1 portal service QoQ YoY enrich"
