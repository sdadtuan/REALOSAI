#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
test -f "$ROOT/docs/specs/postgresql-ddl-hr-employee-file-p4.sql"
rg -q 'hr_doc_wallet' "$ROOT/docs/specs/postgresql-ddl-hr-employee-file-p4.sql"
echo "OK  P4 M3 DDL present"
