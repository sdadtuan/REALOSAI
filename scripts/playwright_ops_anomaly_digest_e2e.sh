#!/usr/bin/env bash
# RNOS-28 — Playwright anomaly digest smoke
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export OPS_E2E_URL="${OPS_E2E_URL:-http://127.0.0.1:3200}"
export OPS_E2E_API_URL="${OPS_E2E_API_URL:-http://127.0.0.1:3000}"
export OPS_E2E_SKIP_SERVER="${OPS_E2E_SKIP_SERVER:-1}"
export PTT_AI_ANOMALY_DIGEST_ENABLED="${PTT_AI_ANOMALY_DIGEST_ENABLED:-1}"

cd "$ROOT/services/ops-web"
if [[ ! -d node_modules/@playwright/test ]]; then npm install; fi
if [[ ! -d ~/.cache/ms-playwright ]] && [[ ! -d node_modules/playwright/.local-browsers ]]; then
  npx playwright install chromium
fi
npm run test:e2e:anomaly-digest
