"""RNOS Gate Phase 0 — metric checks."""
from __future__ import annotations

import unittest
from unittest.mock import MagicMock, patch


class TestRnosPhase0Gates(unittest.TestCase):
    @patch("ptt_crm.pg_schema.pg_revenue_os_ai_smoke_insert_ok", return_value=True)
    @patch("ptt_crm.pg_schema.pg_revenue_os_ai_ready", return_value=True)
    @patch("ptt_crm.pg_schema.pg_revenue_os_ai_r1_core_ready", return_value=True)
    @patch("ptt_crm.pg_schema.pg_revenue_os_ai_migration_applied", return_value=True)
    def test_rnos01_check(self, *_mocks: object) -> None:
        from ptt_crm.rnos_phase0_gates import phase0_rnos01_ready

        check = phase0_rnos01_ready()
        self.assertTrue(check.ok)
        self.assertEqual(check.id, "P0-G01")

    @patch("ptt_jobs.db.pg_connection")
    def test_timeline_completeness_pass(self, mock_conn: MagicMock) -> None:
        from ptt_crm.rnos_phase0_gates import phase0_timeline_completeness

        cursor = MagicMock()
        cursor.fetchone.return_value = (50, 40)
        mock_conn.return_value.__enter__.return_value.cursor.return_value.__enter__.return_value = cursor

        check = phase0_timeline_completeness(min_sample=50, min_pct=70)
        self.assertTrue(check.ok)
        self.assertEqual(check.detail["completeness_pct"], 80.0)

    @patch("ptt_jobs.db.pg_connection")
    def test_attribution_pass(self, mock_conn: MagicMock) -> None:
        from ptt_crm.rnos_phase0_gates import phase0_attribution_coverage

        cursor = MagicMock()
        cursor.fetchone.return_value = (100, 85)
        mock_conn.return_value.__enter__.return_value.cursor.return_value.__enter__.return_value = cursor

        check = phase0_attribution_coverage(min_pct=80)
        self.assertTrue(check.ok)


if __name__ == "__main__":
    unittest.main()
