#!/usr/bin/env bash
# P1 §4.3 — Playwright lead attribution smoke
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export OPS_E2E_URL="${OPS_E2E_URL:-http://127.0.0.1:3200}"
export OPS_E2E_API_URL="${OPS_E2E_API_URL:-http://127.0.0.1:3000}"
export OPS_E2E_SKIP_SERVER="${OPS_E2E_SKIP_SERVER:-0}"
export OPS_E2E_USE_DEV="${OPS_E2E_USE_DEV:-1}"
export NEXT_PUBLIC_PTT_API_URL="${NEXT_PUBLIC_PTT_API_URL:-$OPS_E2E_API_URL}"

(
  cd "$ROOT/services/ops-web"
  npm run test:e2e:lead-attribution
)
