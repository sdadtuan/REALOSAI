#!/usr/bin/env bash
set -euo pipefail
cd "$(cd "$(dirname "$0")/.." && pwd)/services/ptt-crm-api"
npx jest src/hr-employee-file --verbose --no-coverage
echo "OK  P5 M1 hr-employee-file tests"
