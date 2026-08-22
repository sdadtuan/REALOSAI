#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/services/ptt-crm-api"
npm test -- --testPathPattern='market-research' --passWithNoTests --no-coverage
cd "$ROOT/services/ops-web"
npm run test:unit -- src/components/research/conjoint-pane.util.test.ts src/components/research/studies-codebook.util.spec.ts
echo "OK  P21 M5 api + ops-web tests"
