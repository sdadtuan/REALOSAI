"""Unit tests for RBAC catalog gate (R1-S1)."""
from __future__ import annotations

import subprocess
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "scripts"
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


class TestRbacCatalogGate(unittest.TestCase):
    def test_crm_email_mkt_in_admin_catalog(self) -> None:
        from admin_page_permissions import ADMIN_CRM_SECTION_IDS

        self.assertIn("crm_email_mkt", ADMIN_CRM_SECTION_IDS)

    def test_catalog_includes_admin_and_buttons(self) -> None:
        from rbac_catalog import build_catalog_section_ids
        from admin_page_permissions import ADMIN_CRM_SECTION_IDS
        from ptt_ui_button_permissions import CRM_UI_BUTTON_IDS

        catalog = build_catalog_section_ids()
        self.assertTrue(ADMIN_CRM_SECTION_IDS <= catalog)
        self.assertTrue(CRM_UI_BUTTON_IDS <= catalog)

    def test_no_orphan_guard_sections(self) -> None:
        from rbac_catalog import collect_orphan_sections, build_catalog_section_ids

        orphans, _files = collect_orphan_sections(build_catalog_section_ids())
        self.assertEqual(orphans, [], msg=f"orphan sections: {orphans}")

    def test_catalog_gate_script_passes(self) -> None:
        gate = ROOT / "scripts" / "rbac_catalog_gate.sh"
        self.assertTrue(gate.is_file(), msg=str(gate))
        proc = subprocess.run(
            ["bash", str(gate)],
            cwd=ROOT,
            capture_output=True,
            text=True,
            check=False,
        )
        self.assertEqual(
            proc.returncode,
            0,
            msg=f"stdout:\n{proc.stdout}\nstderr:\n{proc.stderr}",
        )
        self.assertIn("PASS", proc.stdout)

    def test_catalog_json_generated(self) -> None:
        json_path = ROOT / "docs" / "exports" / "rbac_catalog.json"
        if json_path.is_file():
            json_path.unlink()
        proc = subprocess.run(
            [sys.executable, str(ROOT / "scripts" / "rbac_catalog.py"), "--check", "--write-json"],
            cwd=ROOT,
            capture_output=True,
            text=True,
            check=False,
        )
        self.assertEqual(proc.returncode, 0, msg=proc.stderr or proc.stdout)
        self.assertTrue(json_path.is_file())
        self.assertIn('"crm_email_mkt"', json_path.read_text(encoding="utf-8"))


if __name__ == "__main__":
    unittest.main()
