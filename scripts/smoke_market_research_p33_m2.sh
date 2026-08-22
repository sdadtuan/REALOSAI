#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/services/ops-web"
npm run test:unit -- src/lib/published-valid-to.util.spec.ts
echo "OK  P33 M2 ops-web published-valid-to util"
