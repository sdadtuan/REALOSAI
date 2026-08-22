#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEPLOY="$ROOT/scripts/deploy_market_research_p39_vps.sh"
INSTALL="$ROOT/scripts/install_pgvector_vps.sh"
python3 - <<PY
from pathlib import Path
for path in ("$DEPLOY", "$INSTALL"):
    text = Path(path).read_text()
    assert "OPENAI_API_KEY" not in text or "does NOT set OPENAI_API_KEY" in text or "OPENAI_API_KEY untouched" in text or "OPENAI_API_KEY manual" in text
    assert "OPENAI_API_KEY=" not in text
print("OK  P39 M4 scripts never assign OPENAI_API_KEY")
PY
