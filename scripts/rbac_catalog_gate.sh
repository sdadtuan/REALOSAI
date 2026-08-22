#!/usr/bin/env bash
# RBAC-R1 — fail if Nest/ops-web guards reference sections outside catalog
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PYTHON="${PYTHON:-python3}"
if [[ -x "$ROOT/.venv/bin/python" ]]; then
  PYTHON="$ROOT/.venv/bin/python"
fi

export PYTHONPATH="$ROOT${PYTHONPATH:+:$PYTHONPATH}"

echo "== RBAC catalog gate =="
"$PYTHON" scripts/rbac_catalog.py --check --write-json
echo "== RBAC permission sets catalog subset =="
"$PYTHON" scripts/rbac_permission_sets_gate.py
