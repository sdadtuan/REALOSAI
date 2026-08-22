#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
grep -q 'Walkthrough UAT P13' "$ROOT/docs/use-cases/actions/12-RES-ACTIONS.md"
echo "OK  P13 M5 UAT docs present"
