#!/usr/bin/env bash
# WIN-4-B — field registry caps ⊆ rbac-admin-catalog.json
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
PYTHON="${PYTHON:-python3}"
if [[ -x "$ROOT/.venv/bin/python" ]]; then
  PYTHON="$ROOT/.venv/bin/python"
fi
echo "== RBAC field registry gate =="
"$PYTHON" scripts/rbac_field_registry_gate.py
