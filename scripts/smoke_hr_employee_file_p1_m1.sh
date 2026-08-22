#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/services/ptt-crm-api"
npx jest src/hr-employee-file --verbose --no-coverage
echo "OK  P1 M1 hr-employee-file unit tests"
