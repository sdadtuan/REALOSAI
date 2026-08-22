#!/usr/bin/env bash
# Smoke P8 M4 — Deploy syntax + RAG not enabled (RES-UC-072).
#
#   bash scripts/smoke_market_research_p8_m4.sh
#
# Gates: flag off P0 prompt; draft not in prior; PII skip RAG; 1 draft; no publish.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEPLOY="$ROOT/scripts/deploy_market_research_p8_vps.sh"

echo "==> bash -n deploy_market_research_p8_vps.sh"
bash -n "$DEPLOY"
echo "OK  bash -n deploy_market_research_p8_vps.sh"

python3 - <<PY
from pathlib import Path
deploy = Path("$DEPLOY").read_text()
assert "apply_pg_ddl_market_research_p7.sh" in deploy
assert "apply_pg_ddl_market_research_p8" not in deploy
assert "1/4" in deploy and "2/4" in deploy and "3/4" in deploy and "4/4" in deploy
assert "portal-web" in deploy
assert "git pull --ff-only origin main" in deploy
patch = deploy.split("patch_runtime_env()", 1)[1].split("export_public_flag_from_runtime", 1)[0]
assert "PTT_MARKET_RESEARCH_ENABLED=1" in patch
assert "NEXT_PUBLIC_MARKET_RESEARCH=1" in patch
assert "RESEARCH_RAG_ENABLED=1" not in patch
assert "RESEARCH_QUALTRICS_ENABLED=1" not in patch
assert "RESEARCH_SPARKTORO_ENABLED=1" not in patch
assert "QUALTRICS_API_KEY" not in patch
assert "SPARKTORO_API_KEY" not in patch
print("OK  deploy clone: P7 DDL last, no P8 DDL, P0 flags only, no RAG/Qualtrics/SparkToro keys")
PY

echo "RAG not enabled in deploy"
echo "Gates: flag off P0 prompt; draft not in prior; PII skip RAG; 1 draft; no publish"
echo "OK  market research P8 M4 smoke"
