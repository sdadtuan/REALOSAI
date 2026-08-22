#!/usr/bin/env bash
# S3 / S4 — presales funnel metrics parity gate.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

fail=0

echo "==> pytest crm_presales_funnel_metrics"
export PYTHONPATH="$ROOT${PYTHONPATH:+:$PYTHONPATH}"
if ! python3 -m pytest tests/test_crm_presales_funnel_metrics.py -q --tb=short; then
  fail=1
fi

echo "==> Nest jest presales-funnel-metrics"
cd "$ROOT/services/ptt-crm-api"
if ! npm test -- --testPathPattern='presales-funnel-metrics' --silent 2>/dev/null; then
  fail=1
fi

if [[ "$fail" -eq 0 ]]; then
  echo '{"gate":"presales_funnel_metrics","ok":true}'
  exit 0
fi
echo '{"gate":"presales_funnel_metrics","ok":false}'
exit 1
