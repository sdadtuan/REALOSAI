#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/services/ptt-crm-api"
npm test -- --testPathPattern='insight-stale.util.spec' --verbose --no-coverage
echo "OK  P18 M1 insight stale util"
