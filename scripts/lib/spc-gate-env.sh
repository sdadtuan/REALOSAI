#!/usr/bin/env bash
# Source VPS/local env before SPC gate scripts (DATABASE_URL, PTT_CRM_INTERNAL_KEY, …).
ROOT="${SPC_GATE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
if [[ -f "$ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env"
  set +a
fi
export PTT_API_URL="${PTT_API_URL:-http://127.0.0.1:3000}"
