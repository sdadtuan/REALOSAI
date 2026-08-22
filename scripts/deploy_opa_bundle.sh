#!/usr/bin/env bash
# Validate OPA policy bundle for WIN-4-C (manifest + rego files).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MANIFEST="$ROOT/policies/presales/manifest.json"

echo "== OPA bundle gate =="
test -f "$MANIFEST"
python3 - <<'PY' "$MANIFEST" "$ROOT/policies/presales"
import json, sys
from pathlib import Path
manifest_path = Path(sys.argv[1])
root = Path(sys.argv[2])
data = json.loads(manifest_path.read_text())
version = data.get("version")
policies = data.get("policies") or []
if not version:
    raise SystemExit("manifest missing version")
if len(policies) < 3:
    raise SystemExit(f"expected >=3 policies, got {len(policies)}")
for pid in policies:
    slug = pid.split(".", 1)[-1] if "." in pid else pid
    candidates = list(root.glob(f"*{slug}*.rego"))
    if not candidates:
        raise SystemExit(f"missing rego for policy {pid}")
print(f"OPA bundle OK ({version}, {len(policies)} policies)")
PY
