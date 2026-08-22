#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/services/ptt-crm-api"
npm test -- --testPathPattern='market-research.service.spec' --testNamePattern='P18 getProject passes is_stale' --verbose --no-coverage
echo "OK  P18 M2 service is_stale on insights"
