#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
grep -q 'HR-UC-002' "$ROOT/docs/specs/modules/RNOSAI-BA-HR-UseCases.md"
grep -q 'staff/:id/contracts' "$ROOT/docs/specs/modules/RNOSAI-BA-HR-UseCases.md"
echo "OK  P2 M5 use-case doc"
