#!/usr/bin/env python3
"""P2-LG-05 — fail if Nest lifecycle JSON diverges from Python workflow steps."""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
JSON_PATH = ROOT / "services/ptt-crm-api/src/leads-contract/lifecycle-workflow-steps.data.json"
LIFECYCLE_STAGES = ("onboard", "deliver", "handover", "retain")

if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


def _normalize_step(step: dict) -> dict:
    return {
        "title": step["title"],
        "description": step.get("description", ""),
        "ai_prompt_key": step.get("ai_prompt_key", ""),
        "form_fields": step.get("form_fields") or [],
    }


def _export_from_python() -> dict[str, dict]:
    from crm_svc_workflow_steps import SERVICE_WORKFLOW_STEPS

    out: dict[str, dict] = {}
    for slug, stages in SERVICE_WORKFLOW_STEPS.items():
        entry: dict = {}
        for stage in LIFECYCLE_STAGES:
            if stage in stages:
                entry[stage] = [_normalize_step(s) for s in stages[stage]]
        if entry:
            out[slug] = entry
    return out


def main() -> int:
    if not JSON_PATH.is_file():
        print(f"MISSING {JSON_PATH}", file=sys.stderr)
        return 1

    nest = json.loads(JSON_PATH.read_text(encoding="utf-8"))
    py = _export_from_python()
    errors: list[str] = []

    for slug in sorted(set(py.keys()) | set(nest.keys())):
        if slug not in py:
            errors.append(f"{slug}: missing in Python SERVICE_WORKFLOW_STEPS")
            continue
        if slug not in nest:
            errors.append(f"{slug}: missing in lifecycle-workflow-steps.data.json")
            continue
        for stage in LIFECYCLE_STAGES:
            py_steps = py[slug].get(stage, [])
            nest_steps = nest[slug].get(stage, [])
            if py_steps != nest_steps:
                errors.append(f"{slug}.{stage}: Python/Nest mismatch ({len(py_steps)} vs {len(nest_steps)} steps)")

    if errors:
        print("Lifecycle workflow parity FAILED:", file=sys.stderr)
        for line in errors:
            print(f"  - {line}", file=sys.stderr)
        return 1

    print(f"OK lifecycle parity — {len(py)} slugs × {len(LIFECYCLE_STAGES)} stages")
    return 0


if __name__ == "__main__":
    sys.exit(main())
