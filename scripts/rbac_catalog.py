#!/usr/bin/env python3
"""RBAC section catalog — single registry for CI guard parity (R1-S1)."""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from admin_page_permissions import ADMIN_CRM_SECTION_IDS  # noqa: E402
from ptt_ui_button_permissions import CRM_UI_BUTTON_IDS  # noqa: E402

# Sections referenced by Nest/ops-web guards but not yet in ADMIN_CRM_SECTIONS.
# Add new entries here only as a temporary bridge — prefer ADMIN_CRM_SECTIONS.
EXTRA_GUARD_SECTIONS: frozenset[str] = frozenset(
    {
        "ai_analytics",
        "ai_forecast",
        "ai_orchestrator",
        "automation_workflows",
        "crm_board",
        "crm_search",
        "crm_seo",
        "crm_service_lifecycle",
        "crm_zalo_ads",
        "dashboard",
        "meta_ads_ops",
        "meta_campaign_write",
        "playbooks",
    }
)

SCAN_ROOTS: tuple[Path, ...] = (
    ROOT / "services" / "ptt-crm-api" / "src",
    ROOT / "services" / "ops-web" / "src",
)

SECTION_PATTERNS: tuple[re.Pattern[str], ...] = (
    re.compile(r"""hasCap\s*\(\s*[^,]+,\s*['"]([^'"]+)['"]"""),
    re.compile(r"""section\s*:\s*['"]([^'"]+)['"]"""),
)

DEFAULT_JSON = ROOT / "docs" / "exports" / "rbac_catalog.json"


def build_catalog_section_ids() -> frozenset[str]:
    return ADMIN_CRM_SECTION_IDS | CRM_UI_BUTTON_IDS | EXTRA_GUARD_SECTIONS


def scan_guard_section_refs() -> dict[str, set[str]]:
    refs: dict[str, set[str]] = {}
    for base in SCAN_ROOTS:
        if not base.is_dir():
            continue
        for path in base.rglob("*"):
            if path.suffix not in {".ts", ".tsx"}:
                continue
            try:
                text = path.read_text(encoding="utf-8")
            except OSError:
                continue
            rel = str(path.relative_to(ROOT))
            found: set[str] = set()
            for pattern in SECTION_PATTERNS:
                found.update(pattern.findall(text))
            if found:
                refs[rel] = found
    return refs


def collect_orphan_sections(catalog: frozenset[str]) -> tuple[sorted[str], dict[str, sorted[str]]]:
    refs_by_file = scan_guard_section_refs()
    orphans: set[str] = set()
    orphan_files: dict[str, list[str]] = {}
    for rel, sections in refs_by_file.items():
        bad = sorted(s for s in sections if s not in catalog)
        if bad:
            orphans.update(bad)
            orphan_files[rel] = bad
    return sorted(orphans), {k: v for k, v in sorted(orphan_files.items())}


def build_catalog_document() -> dict[str, object]:
    catalog = build_catalog_section_ids()
    admin = sorted(ADMIN_CRM_SECTION_IDS)
    buttons = sorted(CRM_UI_BUTTON_IDS)
    extra = sorted(EXTRA_GUARD_SECTIONS)
    orphans, orphan_files = collect_orphan_sections(catalog)
    return {
        "version": "rbac-catalog-r1-s1",
        "section_count": len(catalog),
        "sections": sorted(catalog),
        "sources": {
            "admin_crm_sections": admin,
            "crm_ui_buttons": buttons,
            "extra_guard_sections": extra,
        },
        "orphan_sections": orphans,
        "orphan_files": orphan_files,
    }


def write_json(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    doc = build_catalog_document()
    path.write_text(json.dumps(doc, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wrote {path} ({doc['section_count']} sections)")


def check_catalog(*, write_json_path: Path | None = None) -> int:
    catalog = build_catalog_section_ids()
    orphans, orphan_files = collect_orphan_sections(catalog)

    print(f"== RBAC catalog gate ==")
    print(f"Catalog sections: {len(catalog)}")
    print(f"  admin_crm_sections: {len(ADMIN_CRM_SECTION_IDS)}")
    print(f"  crm_ui_buttons: {len(CRM_UI_BUTTON_IDS)}")
    print(f"  extra_guard_sections: {len(EXTRA_GUARD_SECTIONS)}")

    if write_json_path is not None:
        write_json(write_json_path)

    if not orphans:
        print("")
        print(f"RBAC catalog gate: PASS ({len(catalog)} sections, 0 orphans)")
        return 0

    print("")
    print(f"FAIL orphan guard sections not in catalog ({len(orphans)}):")
    for section_id in orphans:
        print(f"  - {section_id}")
    print("")
    print("Referenced from:")
    for rel, sections in orphan_files.items():
        print(f"  {rel}: {', '.join(sections)}")
    print("")
    print("Fix: add to ADMIN_CRM_SECTIONS or EXTRA_GUARD_SECTIONS in scripts/rbac_catalog.py")
    return 1


def main() -> int:
    parser = argparse.ArgumentParser(description="RBAC section catalog gate (R1-S1)")
    parser.add_argument(
        "--check",
        action="store_true",
        help="Fail if guard references unknown sections (default)",
    )
    parser.add_argument(
        "--write-json",
        nargs="?",
        const=str(DEFAULT_JSON),
        metavar="PATH",
        help=f"Write catalog JSON (default: {DEFAULT_JSON.relative_to(ROOT)})",
    )
    args = parser.parse_args()

    write_path = Path(args.write_json) if args.write_json else None
    if args.check or write_path is None:
        return check_catalog(write_json_path=write_path)
    write_json(write_path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
