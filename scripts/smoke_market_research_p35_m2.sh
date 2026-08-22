#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/services/ptt-crm-api"
npm test -- --testPathPattern='src/portal-research/portal-research.service.spec.ts' --testNamePattern='P35' --passWithNoTests --no-coverage
echo "OK  P35 M2 service spec"
