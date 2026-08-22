#!/usr/bin/env bash
# Validate compliance pack JSON files
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PACK_DIR="$ROOT/services/ptt-crm-api/config/compliance-packs"

echo "== Validate compliance packs =="
python3 - <<'PY' "$PACK_DIR"
import json, sys
from pathlib import Path
pack_dir = Path(sys.argv[1])
required = {"code", "label", "description", "permission_sets", "position_grants"}
for path in sorted(pack_dir.glob("*.json")):
    data = json.loads(path.read_text())
    missing = required - set(data.keys())
    if missing:
        raise SystemExit(f"{path.name}: missing keys {missing}")
    if data["code"] != path.stem:
        raise SystemExit(f"{path.name}: code mismatch {data['code']}")
    if not isinstance(data["permission_sets"], list):
        raise SystemExit(f"{path.name}: permission_sets must be array")
    if not isinstance(data["position_grants"], dict):
        raise SystemExit(f"{path.name}: position_grants must be object")
    for pos, grants in data["position_grants"].items():
        if not isinstance(grants, list):
            raise SystemExit(f"{path.name}: position_grants[{pos}] must be array")
        for g in grants:
            if not g.get("section") or not g.get("action"):
                raise SystemExit(f"{path.name}: grant missing section/action in {pos}")
    print(f"OK  {path.name}")
print(f"Validated {len(list(pack_dir.glob('*.json')))} packs")
PY
