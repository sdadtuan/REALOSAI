#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/services/portal-web"
npx --yes vitest@2 run src/lib/published-valid-to.util.spec.ts
echo "OK  P33 M1 portal published-valid-to util"
