#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
python3 -m pytest tests/test_research_rag_reembed.py -q
echo "OK  P13 M3 python worker reembed"
