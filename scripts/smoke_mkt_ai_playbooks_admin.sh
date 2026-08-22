#!/usr/bin/env bash
# WS-P4-08 — admin playbook catalog smoke (GET /api/v1/admin/mkt-ai/playbooks)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ -f "$ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env"
  set +a
fi

API_URL="${PTT_API_URL:-http://127.0.0.1:3000}"
KEY="${PTT_CRM_INTERNAL_KEY:-}"

AUTH=()
if [[ -n "$KEY" ]]; then
  AUTH=(-H "x-ptt-internal-key: $KEY")
else
  echo "SKIP admin playbooks — set PTT_CRM_INTERNAL_KEY"
  exit 0
fi

echo "== smoke_mkt_ai_playbooks_admin WS-P4-08 =="
echo "api=$API_URL"

out="$(curl -sf "${AUTH[@]}" "$API_URL/api/v1/admin/mkt-ai/playbooks")"
echo "$out" | grep -q '"ok":true' || { echo "FAIL admin playbooks shape"; exit 1; }
count="$(echo "$out" | python3 -c "import sys,json; print(json.load(sys.stdin).get('count',0))" 2>/dev/null || echo 0)"
[[ "$count" -ge 3 ]] || { echo "FAIL expected count>=3 got $count"; exit 1; }
echo "$out" | grep -q '"schema_valid":true' || echo "WARN some playbooks report schema_valid false"
echo "OK admin playbooks count=$count"
echo "PASS smoke_mkt_ai_playbooks_admin"
