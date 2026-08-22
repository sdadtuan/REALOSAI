#!/usr/bin/env bash
# RNOS-M3 Phase 3 — Pilot KPI snapshot (4-week window)
#   DATABASE_URL=postgresql://... KPI_DAYS=28 bash scripts/m3_pilot_kpi_collect.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DAYS="${KPI_DAYS:-28}"
OUT_JSON="${OUT_JSON:-$ROOT/.local-dev/m3-pilot-kpi-snapshot.json}"
OUT_MD="${OUT_MD:-$ROOT/.local-dev/m3-pilot-kpi-snapshot.md}"
DATABASE_URL="${DATABASE_URL:-postgresql://ptt:ptt_dev@127.0.0.1:5433/rnosaidb}"

mkdir -p "$(dirname "$OUT_JSON")"

run_query() {
  if ! command -v psql >/dev/null 2>&1; then
    echo "[]"
    return
  fi
  psql "$DATABASE_URL" -v ON_ERROR_STOP=0 -t -A -c "$1" 2>/dev/null || echo ""
}

echo "== M3 Pilot KPI (${DAYS} days) =="

native_devices="$(run_query "
SELECT coalesce(json_agg(row_to_json(t)), '[]'::json)::text FROM (
  SELECT platform, count(*)::int AS devices, count(DISTINCT portal_user_id)::int AS users
  FROM portal_native_device_tokens
  WHERE updated_at >= NOW() - (${DAYS} || ' days')::interval
  GROUP BY platform
) t;
")"

native_empty="true"
if [[ "$native_devices" != "[]" && -n "$native_devices" ]]; then
  native_empty="false"
fi

approve_mobile="$(run_query "
SELECT coalesce(avg(extract(epoch from (decided_at - created_at))), 0)::int
FROM portal_creative_approvals
WHERE decided_at IS NOT NULL
  AND decided_at >= NOW() - (${DAYS} || ' days')::interval
  AND user_agent ILIKE '%capacitor%';
" 2>/dev/null || echo "0")"

python3 - <<PY
import json, datetime
from pathlib import Path

report = {
  "generated_at": datetime.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
  "phase": "3-pilot-enterprise",
  "window_days": int("$DAYS"),
  "database_url_redacted": "configured" if "$DATABASE_URL" else "missing",
  "native_devices_by_platform": json.loads('$native_devices' if '$native_devices' else '[]'),
  "median_time_to_approve_mobile_sec": int("$approve_mobile" or 0),
  "targets": {
    "push_delivery_native_pct": 85,
    "crash_free_sessions_pct": 99,
    "deeplink_success_pct": 95,
  },
  "notes": "Fill push_delivery + crash_free from Firebase/TestFlight/Play Console exports",
}
Path("$OUT_JSON").write_text(json.dumps(report, indent=2) + "\\n")

md = f"""# M3 Pilot KPI Snapshot

Generated: {report['generated_at']}
Window: {report['window_days']} days

## Native devices registered
\`\`\`json
{json.dumps(report['native_devices_by_platform'], indent=2)}
\`\`\`

## Median time-to-approve (mobile / capacitor UA)
- **{report['median_time_to_approve_mobile_sec']}s** (0 = no PG data or table missing)

## Manual imports required
- Push delivery iOS/Android % — Firebase + APNs dashboards
- Crash-free sessions — TestFlight / Play Vitals
- Deep link success — AM UAT checklist tally
"""
Path("$OUT_MD").write_text(md)
print(f"OK  {Path('$OUT_JSON').name}")
print(f"OK  {Path('$OUT_MD').name}")
PY
