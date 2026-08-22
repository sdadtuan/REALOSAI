#!/usr/bin/env bash
set -euo pipefail
cd "$(cd "$(dirname "$0")/.." && pwd)/services/ptt-crm-api"
npm run build
echo "OK  P4 M4 api build"
