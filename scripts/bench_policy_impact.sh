#!/usr/bin/env bash
# Bench policy impact API — p95 target <2000ms
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
API="${PTT_CRM_API_URL:-http://127.0.0.1:3000}"
TOKEN="${STAFF_BENCH_TOKEN:-}"
POSITION_ID="${BENCH_POSITION_ID:-1}"
RUNS="${BENCH_RUNS:-20}"

if [[ -z "$TOKEN" ]]; then
  echo "Set STAFF_BENCH_TOKEN (staff JWT) to run bench"
  exit 1
fi

body=$(cat <<EOF
{"position_id":${POSITION_ID},"patch":{"removed":[{"section":"crm_leads","action":"view_pii"}]},"limit":50}
EOF
)

times=()
for ((i=1; i<=RUNS; i++)); do
  start=$(python3 - <<'PY'
import time; print(int(time.time()*1000))
PY
)
  code=$(curl -s -o /tmp/bench_impact.json -w "%{http_code}" \
    -X POST "$API/api/v1/admin/policy/simulate-impact" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "$body")
  end=$(python3 - <<'PY'
import time; print(int(time.time()*1000))
PY
)
  if [[ "$code" != "200" && "$code" != "201" ]]; then
    echo "HTTP $code — $(cat /tmp/bench_impact.json)"
    exit 1
  fi
  elapsed=$((end - start))
  times+=("$elapsed")
  echo "run $i: ${elapsed}ms"
done

python3 - <<'PY' "${times[@]}"
import sys
vals = sorted(int(x) for x in sys.argv[1:])
n = len(vals)
p95 = vals[int(n * 0.95) - 1] if n else 0
avg = sum(vals) / n if n else 0
print(f"p95={p95}ms avg={avg:.0f}ms n={n}")
if p95 >= 2000:
    raise SystemExit(f"p95 gate failed: {p95}ms >= 2000ms")
print("OK  policy impact bench passed")
PY
