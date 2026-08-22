#!/usr/bin/env bash
# S2 — Playwright consult workspace e2e (presales-on-lead).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/services/ops-web"
npm run test:e2e:consult-workspace
