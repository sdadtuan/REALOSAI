#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/services/ops-web"
npm run test:unit -- src/components/research/research-rag-reembed.util.spec.ts
echo "OK  P40 M1 re-embed util unit tests"
