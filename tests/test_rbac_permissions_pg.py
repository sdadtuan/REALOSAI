"""Unit tests for RBAC PostgreSQL helpers and no-SQLite policy gate."""
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


class TestRbacPermissionsPg(unittest.TestCase):
    def test_cap_rows_kd01_has_presales_view_only(self) -> None:
        from rbac_permissions_pg import cap_rows_for_position, presales_solution_cap_rows

        presales = presales_solution_cap_rows("KD-01")
        self.assertEqual(presales, [("crm_presales_solution", "view")])

        caps = {f"{s}.{a}" for s, a in cap_rows_for_position("KD-01")}
        self.assertIn("crm_presales_solution.view", caps)
        self.assertNotIn("crm_presales_solution.claim", caps)

    def test_cap_rows_mkt01_has_claim_release(self) -> None:
        from rbac_permissions_pg import presales_solution_cap_rows

        presales = {a for _, a in presales_solution_cap_rows("MKT-01")}
        self.assertEqual(presales, {"view", "edit", "claim", "release"})

    def test_build_super_admin_includes_presales_solution(self) -> None:
        from rbac_permissions_pg import build_super_admin_caps

        caps = set(build_super_admin_caps())
        self.assertIn(("crm_presales_solution", "claim"), caps)
        self.assertIn(("crm_leads", "assign"), caps)
        self.assertIn(("crm_research", "run"), caps)

    def test_crm_research_defaults_mkt01_has_run_approve_kd01_does_not(self) -> None:
        from admin_page_permissions import _POSITION_DEFAULT
        from rbac_permissions_pg import cap_rows_for_position

        mkt = _POSITION_DEFAULT["MKT-01"]["crm_research"]
        kd = _POSITION_DEFAULT["KD-01"]["crm_research"]
        self.assertIn("run", mkt)
        self.assertIn("approve", mkt)
        self.assertNotIn("run", kd)
        self.assertNotIn("approve", kd)

        mkt_rows = {f"{s}.{a}" for s, a in cap_rows_for_position("MKT-01")}
        kd_rows = {f"{s}.{a}" for s, a in cap_rows_for_position("KD-01")}
        self.assertIn("crm_research.run", mkt_rows)
        self.assertIn("crm_research.approve", mkt_rows)
        self.assertNotIn("crm_research.run", kd_rows)
        self.assertNotIn("crm_research.approve", kd_rows)

    def test_pilot_codes_subset_of_defaults(self) -> None:
        from rbac_permissions_pg import PILOT_POSITION_CODES, all_default_position_codes

        defaults = set(all_default_position_codes())
        for code in PILOT_POSITION_CODES:
            self.assertIn(code, defaults)


class TestRbacNoSqliteGate(unittest.TestCase):
    def test_gate_passes(self) -> None:
        gate = ROOT / "scripts" / "rbac_no_sqlite_gate.sh"
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


if __name__ == "__main__":
    unittest.main()
