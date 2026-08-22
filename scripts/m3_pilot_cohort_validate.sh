#!/usr/bin/env bash
# RNOS-M3 Phase 3 — Validate pilot cohort JSON
#   bash scripts/m3_pilot_cohort_validate.sh [path/to/m3-pilot-cohort.json]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FILE="${1:-$ROOT/deploy/m3-pilot-cohort.json}"

if [[ ! -f "$FILE" ]]; then
  echo "FAIL  Missing cohort file: $FILE"
  echo "      Copy: cp deploy/m3-pilot-cohort.example.json deploy/m3-pilot-cohort.json"
  exit 1
fi

python3 - <<PY
import json, sys
from pathlib import Path
p = Path("$FILE")
data = json.loads(p.read_text())
errors = []

if data.get("phase") != "3-pilot-enterprise":
    errors.append("phase must be 3-pilot-enterprise")

ec = data.get("enterprise_client") or {}
if not ec.get("client_id") or "TBD" in str(ec.get("legal_name", "")):
    errors.append("enterprise_client.client_id and legal_name required")
if not (ec.get("am_champion") or {}).get("email"):
    errors.append("enterprise_client.am_champion.email required")

targets = data.get("cohort_targets") or {}
if targets.get("ios_approvers_min", 0) < 3:
    errors.append("cohort_targets.ios_approvers_min should be >= 3")
if targets.get("android_approvers_min", 0) < 3:
    errors.append("cohort_targets.android_approvers_min should be >= 3")

members = data.get("members") or []
ios = sum(1 for m in members if m.get("platform") == "ios")
android = sum(1 for m in members if m.get("platform") == "android")
if ios < 1 or android < 1:
    errors.append(f"members need ios + android rows (got ios={ios} android={android})")

if errors:
    print("FAIL cohort validation:")
    for e in errors:
        print(f"  - {e}")
    sys.exit(1)

print(f"OK  cohort valid: {p.name}")
print(f"    enterprise: {ec.get('legal_name')} ({ec.get('client_id')})")
print(f"    members: {len(members)} (ios={ios} android={android})")
PY
