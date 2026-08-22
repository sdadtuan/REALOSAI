#!/usr/bin/env python3
"""WIN-3-A — ensure permission set grant sections/actions exist in Nest RBAC catalog."""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / "services" / "ptt-crm-api" / "src" / "staff-permissions" / "rbac-admin-catalog.json"


def main() -> int:
    if not CATALOG.is_file():
        print(f"FAIL missing catalog: {CATALOG}", file=sys.stderr)
        return 1

    doc = json.loads(CATALOG.read_text(encoding="utf-8"))
    permission_ids = set(doc.get("permission_ids") or [])
    section_actions: dict[str, list[str]] = doc.get("section_actions") or {}

    errors: list[str] = []
    for section_id, actions in section_actions.items():
        if section_id not in permission_ids:
            errors.append(f"section {section_id} missing from permission_ids")

    if "crm_gdkd" not in section_actions:
        errors.append("crm_gdkd section missing from catalog")
    else:
        required = {"override", "assign", "review_queue", "view_all_leads"}
        missing = required - set(section_actions["crm_gdkd"])
        if missing:
            errors.append(f"crm_gdkd missing actions: {sorted(missing)}")

    if errors:
        for err in errors:
            print(f"FAIL {err}", file=sys.stderr)
        return 1

    print(f"OK permission sets catalog gate ({len(section_actions)} sections)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
