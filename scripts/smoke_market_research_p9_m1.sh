#!/usr/bin/env bash
# P9 M1 — sparktoro-client exports + fixture normalize contract.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CLIENT="$ROOT/services/ptt-crm-api/src/market-research/sparktoro-client.util.ts"
FIXTURE="$ROOT/scripts/fixtures/sparktoro-websites.sample.json"

grep -q 'fetchSparktoroAudienceWebsites' "$CLIENT"
grep -q 'normalizeSparktoroWebsites' "$CLIENT"
grep -q 'resolveSparktoroLocation' "$CLIENT"
[[ -f "$FIXTURE" ]]

python3 - <<PY
import json
from pathlib import Path
raw = json.loads(Path("$FIXTURE").read_text())
assert len(raw.get("data") or []) >= 2
print("OK  P9 M1 sparktoro-client exports + fixture")
PY
