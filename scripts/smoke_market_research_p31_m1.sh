#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/services/ptt-crm-api"
npm test -- --testPathPattern='src/market-research/market-research-docx.util.spec.ts' --testNamePattern='P31' --passWithNoTests --no-coverage
echo "OK  P31 M1 DOCX footer renderer"
