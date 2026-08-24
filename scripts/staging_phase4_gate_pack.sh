#!/usr/bin/env bash
# Staging Phase 4 gate pack — Flask readonly + Meta campaign write + ClickHouse scaffold
#
# Usage:
#   set -a && source deploy/env.staging-phase4.example && set +a
#   ./scripts/staging_phase4_gate_pack.sh
#
# Options:
#   --refresh-phase3   re-run Phase 3 staging pack first
#   --skip-phase3      use existing phase3-qa-gate-report.json only
#   --with-clickhouse  run ClickHouse export gate (docker required)
#
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PYTHON="${PYTHON:-python3}"
if [[ -x "$ROOT/.venv/bin/python" ]]; then
  PYTHON="$ROOT/.venv/bin/python"
fi
export PYTHONPATH="$ROOT${PYTHONPATH:+:$PYTHONPATH}"
export PTT_ARTIFACTS_DIR="${PTT_ARTIFACTS_DIR:-$ROOT/.local-dev}"
export DATABASE_URL="${DATABASE_URL:-postgresql://ptt:ptt_dev@127.0.0.1:5432/ptt_agency}"
# shellcheck source=scripts/e2e_pg_bootstrap.sh
source "$ROOT/scripts/e2e_pg_bootstrap.sh"
exec "$PYTHON" "$ROOT/scripts/staging_phase4_gate_pack.py" "$@"
