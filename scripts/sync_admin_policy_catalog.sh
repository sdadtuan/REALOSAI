#!/usr/bin/env bash
# Sync OPA manifest → admin_policy_catalog (via API internal key or psql)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export DATABASE_URL="${DATABASE_URL:-postgresql://ptt:ptt_dev@127.0.0.1:5433/rnosaidb}"
MANIFEST="$ROOT/policies/presales/manifest.json"
API="${PTT_CRM_API_URL:-http://127.0.0.1:3000}"
INTERNAL_KEY="${PTT_INTERNAL_KEY:-}"

echo "== Sync admin policy catalog =="

if [[ -n "$INTERNAL_KEY" ]]; then
  curl -sf -X POST "$API/api/v1/admin/policies/sync" \
    -H "X-Internal-Key: $INTERNAL_KEY" \
    -H "Content-Type: application/json" \
    -d '{}' | python3 -m json.tool
  echo "OK  synced via API"
  exit 0
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "Set PTT_INTERNAL_KEY or install psql for direct sync"
  exit 1
fi

python3 - <<'PY' "$MANIFEST" | psql "$DATABASE_URL" -v ON_ERROR_STOP=1
import json, sys
from pathlib import Path
data = json.loads(Path(sys.argv[1]).read_text())
version = data.get("version", "")
for pid in data.get("policies") or []:
    slug = pid.split(".", 1)[-1] if "." in pid else pid
    rego = f"{slug}.rego"
    desc = pid.replace(".", " — ")
    print(f"""INSERT INTO admin_policy_catalog (policy_id, description, enabled, bundle_version, rego_file)
VALUES ('{pid}', '{desc}', TRUE, '{version}', '{rego}')
ON CONFLICT (policy_id) DO UPDATE SET
  bundle_version = EXCLUDED.bundle_version,
  rego_file = EXCLUDED.rego_file,
  updated_at = NOW();""")
PY

echo "OK  policy catalog synced via psql"
