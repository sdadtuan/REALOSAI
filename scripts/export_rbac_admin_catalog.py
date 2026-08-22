#!/usr/bin/env python3
"""Export RBAC admin catalog JSON for Nest permissions API (R1-S3)."""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from admin_page_permissions import (  # noqa: E402
    ADMIN_CRM_PERMISSION_IDS,
    ADMIN_CRM_SECTIONS,
    _POSITION_DEFAULT,
)
from cms_permissions import CMS_ACTIONS, CMS_ACTION_LABELS_VI  # noqa: E402
from ptt_ui_button_permissions import CRM_UI_BUTTONS  # noqa: E402

OUT = ROOT / "services" / "ptt-crm-api" / "src" / "staff-permissions" / "rbac-admin-catalog.json"

GDKD_SECTION_ACTIONS: tuple[str, ...] = (
    "override",
    "assign",
    "review_queue",
    "view_all_leads",
)

EXTRA_ACTION_LABELS_VI = {
    "write": "Ghi / thao tác",
    "settings": "Cài đặt",
    "compliance": "Tuân thủ",
    "deliverability": "Deliverability",
    "reports": "Báo cáo",
    "assign": "Phân công (GDKD)",
    "override": "Override GDKD",
    "review_queue": "Review queue",
    "view_all_leads": "Xem toàn bộ lead",
    "query": "Truy vấn NL",
    "commit": "Commit forecast",
    "simulate": "Mô phỏng",
    "run": "Chạy job (desk/deep)",
}


def section_action_ids(section_id: str) -> list[str]:
    if section_id == "crm_gdkd":
        return sorted(GDKD_SECTION_ACTIONS)
    acts = set(CMS_ACTIONS)
    for grants in _POSITION_DEFAULT.values():
        raw = grants.get(section_id)
        if raw:
            acts.update(raw)
    return sorted(acts)


def main() -> int:
    section_actions = {sec["id"]: section_action_ids(sec["id"]) for sec in ADMIN_CRM_SECTIONS}
    all_extra = sorted({a for acts in section_actions.values() for a in acts if a not in CMS_ACTIONS})
    action_labels = {**CMS_ACTION_LABELS_VI, **EXTRA_ACTION_LABELS_VI}

    doc = {
        "version": "rbac-admin-catalog-r1-s3",
        "actions": [{"id": a, "label": action_labels.get(a, a)} for a in CMS_ACTIONS],
        "extra_actions": all_extra,
        "extra_action_labels": {a: action_labels.get(a, a) for a in all_extra},
        "section_actions": section_actions,
        "sections": list(ADMIN_CRM_SECTIONS),
        "ui_buttons": list(CRM_UI_BUTTONS),
        "permission_ids": sorted(ADMIN_CRM_PERMISSION_IDS),
    }

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(doc, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wrote {OUT} ({len(doc['sections'])} sections, {len(doc['ui_buttons'])} buttons)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
