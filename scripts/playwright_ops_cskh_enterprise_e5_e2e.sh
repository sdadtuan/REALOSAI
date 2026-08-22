#!/usr/bin/env bash
# E5 — Playwright smoke: home CSKH widgets + CSKH board specs
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OPS="$ROOT/services/ops-web"

if [[ "${OPS_E2E_SKIP_SERVER:-1}" == "1" ]]; then
  echo "SKIP E5 playwright — OPS_E2E_SKIP_SERVER=1 (set 0 to run full stack E2E)"
  exit 0
fi

cd "$OPS"
if [[ ! -d node_modules/@playwright/test ]]; then npm install; fi
if [[ ! -d ~/.cache/ms-playwright ]] && [[ ! -d node_modules/playwright/.local-browsers ]]; then
  npx playwright install chromium
fi

npm run test:e2e:home-cskh-widgets
npm run test:e2e:cskh-board
npm run test:e2e:cskh-board-mobile
