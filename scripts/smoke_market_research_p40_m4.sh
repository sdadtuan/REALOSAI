#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEPLOY="$ROOT/scripts/deploy_market_research_p40_vps.sh"
PANEL="$ROOT/services/ops-web/src/components/research/ResearchRagReembedPanel.tsx"
bash -n "$DEPLOY"
python3 - <<PY
from pathlib import Path
deploy = Path("$DEPLOY").read_text()
panel = Path("$PANEL").read_text()
assert 'flags untouched' in deploy
assert 'RESEARCH_RAG_ENABLED=1' not in deploy
assert 'OPENAI_API_KEY' not in deploy
assert 'OPENAI_API_KEY' not in panel or 'Runbook' in panel
print("OK  P40 M4 deploy prod-safe; panel no secret assignment")
PY
