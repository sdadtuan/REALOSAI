#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEPLOY="$ROOT/scripts/deploy_market_research_p39_vps.sh"
[[ -f "$DEPLOY" ]] || { echo "FAIL  missing $DEPLOY"; exit 1; }
bash -n "$DEPLOY"
grep -q '\-\-enable-rag-staging' "$DEPLOY"
grep -q 'flags untouched' "$DEPLOY"
python3 - <<PY
from pathlib import Path
deploy = Path("$DEPLOY").read_text()
assert '--enable-rag-staging' in deploy
assert 'flags untouched' in deploy
else_branch = deploy.split('else\n    echo "== flags untouched', 1)[1].split('fi\n', 1)[0]
assert 'RESEARCH_RAG_ENABLED=1' not in else_branch
patch = deploy.split('patch_rag_staging_env() {', 1)[1].split('run_local()', 1)[0]
assert 'RESEARCH_RAG_ENABLED=1' in patch
assert 'RESEARCH_RAG_OPENAI_EMBED_ENABLED=1' in patch
assert 'RESEARCH_RAG_PGVECTOR_ENABLED=1' in patch
print("OK  P39 M1 deploy exists; default prod-safe; staging patch has 3 RAG flags")
PY
