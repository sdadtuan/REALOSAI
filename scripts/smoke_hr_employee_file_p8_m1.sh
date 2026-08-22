#!/usr/bin/env bash
set -euo pipefail
cd "$(cd "$(dirname "$0")/.." && pwd)/services/ptt-crm-api"
npx jest src/hr-employee-file/hr-attendance --verbose --no-coverage
echo "OK  P8 M1 hr-attendance tests"
