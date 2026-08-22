#!/usr/bin/env bash
# P2-TPL-04 / S1 gate — lifecycle parity + presales batch upgrade tests.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

fail=0

echo "==> Lifecycle JSON parity (Python vs Nest)"
if ! python3 "$ROOT/scripts/sync_lifecycle_workflow_from_python.py"; then
  fail=1
fi

echo "==> pytest presales upgrade + promote lead-gen"
export PYTHONPATH="$ROOT${PYTHONPATH:+:$PYTHONPATH}"
if ! python3 -m pytest tests/test_crm_lead_presales.py -q --tb=short \
  -k "upgrade_presales or batch_upgrade or promote_lead_gen or list_presales_workflow"; then
  fail=1
fi

echo "==> Nest jest presales batch util"
cd "$ROOT/services/ptt-crm-api"
if ! npm test -- --testPathPattern='presales-workflow-batch|presales-workflow-upgrade' --silent 2>/dev/null; then
  fail=1
fi

if [[ "$fail" -eq 0 ]]; then
  echo '{"gate":"presales_template_upgrade","ok":true}'
  exit 0
fi
echo '{"gate":"presales_template_upgrade","ok":false}'
exit 1
