#!/usr/bin/env python3
"""WIN-4-B — field registry caps must exist in rbac-admin-catalog.json."""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REGISTRY = ROOT / "services/ptt-crm-api/config/rbac_field_registry.json"
CATALOG = ROOT / "services/ptt-crm-api/src/staff-permissions/rbac-admin-catalog.json"


def main() -> int:
    if not REGISTRY.is_file():
        print(f"FAIL missing registry: {REGISTRY}", file=sys.stderr)
        return 1
    if not CATALOG.is_file():
        print(f"FAIL missing catalog: {CATALOG}", file=sys.stderr)
        return 1

    registry = json.loads(REGISTRY.read_text(encoding="utf-8"))
    catalog = json.loads(CATALOG.read_text(encoding="utf-8"))
    section_actions: dict[str, set[str]] = {
        section: set(actions) for section, actions in catalog.get("section_actions", {}).items()
    }

    errors: list[str] = []
    for entry in registry.get("fields", []):
        section = str(entry.get("section", "")).strip()
        action = str(entry.get("action", "")).strip()
        field = str(entry.get("field", "")).strip()
        entity = str(entry.get("entity", "")).strip()
        if not section or not action or not field or not entity:
            errors.append(f"invalid entry (missing keys): {entry}")
            continue
        allowed = section_actions.get(section, set())
        if action not in allowed:
            errors.append(
                f"{entity}.{field} requires {section}.{action} but catalog has {sorted(allowed)}"
            )

    if errors:
        print("RBAC field registry gate FAIL:", file=sys.stderr)
        for err in errors:
            print(f"  - {err}", file=sys.stderr)
        return 1

    count = len(registry.get("fields", []))
    print(f"RBAC field registry gate OK ({count} fields)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
