"""Tests for RBAC admin catalog export (R1-S3)."""
from __future__ import annotations

import json
import subprocess
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CATALOG_JSON = (
    ROOT / "services" / "ptt-crm-api" / "src" / "staff-permissions" / "rbac-admin-catalog.json"
)


class TestExportRbacAdminCatalog(unittest.TestCase):
    def test_export_script_writes_catalog(self) -> None:
        proc = subprocess.run(
            [sys.executable, str(ROOT / "scripts" / "export_rbac_admin_catalog.py")],
            cwd=ROOT,
            capture_output=True,
            text=True,
            check=False,
        )
        self.assertEqual(proc.returncode, 0, msg=proc.stderr or proc.stdout)
        self.assertTrue(CATALOG_JSON.is_file())
        doc = json.loads(CATALOG_JSON.read_text(encoding="utf-8"))
        self.assertIn("crm_email_mkt", doc["section_actions"])
        self.assertIn("write", doc["section_actions"]["crm_email_mkt"])


if __name__ == "__main__":
    unittest.main()
