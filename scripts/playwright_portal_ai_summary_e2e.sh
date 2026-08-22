#!/usr/bin/env bash
# RNOS-30 — Playwright portal AI summary smoke
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export PORTAL_E2E_URL="${PORTAL_E2E_URL:-http://127.0.0.1:3100}"
export PORTAL_E2E_API_URL="${PORTAL_E2E_API_URL:-http://127.0.0.1:3000}"
export PORTAL_E2E_SKIP_SERVER="${PORTAL_E2E_SKIP_SERVER:-1}"
export PORTAL_E2E_APPROVER_EMAIL="${PORTAL_E2E_APPROVER_EMAIL:-approver@demo.local}"
export PORTAL_E2E_APPROVER_PASSWORD="${PORTAL_E2E_APPROVER_PASSWORD:-demo123}"
export PTT_PORTAL_AI_SUMMARY_ENABLED="${PTT_PORTAL_AI_SUMMARY_ENABLED:-1}"

cd "$ROOT/services/portal-web"
if [[ ! -d node_modules/@playwright/test ]]; then
  npm install
fi
if [[ ! -d ~/.cache/ms-playwright ]] && [[ ! -d node_modules/playwright/.local-browsers ]]; then
  npx playwright install chromium
fi
npm run test:e2e -- e2e/portal-ai-summary-rnos30.spec.ts
