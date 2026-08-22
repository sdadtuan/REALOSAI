#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
UTIL="$ROOT/services/ptt-crm-api/src/market-research/qualtrics-client.util.ts"
grep -q 'fetchQualtricsExportCsv' "$UTIL"
grep -q 'decodeQualtricsExportBytes' "$UTIL"
echo "OK  P10 M1 qualtrics client exports"
