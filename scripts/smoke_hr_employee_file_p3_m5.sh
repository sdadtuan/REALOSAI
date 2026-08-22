#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
grep -q 'HR-UC-003' "$ROOT/docs/specs/modules/RNOSAI-BA-HR-UseCases.md"
grep -q 'staff/:id/insurance' "$ROOT/docs/specs/modules/RNOSAI-BA-HR-UseCases.md"
echo "OK  P3 M5 use-case doc"
