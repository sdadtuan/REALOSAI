"""Tests presales Consult→Proposal SLA 48h."""
from __future__ import annotations

import sqlite3
import unittest
from datetime import datetime
from unittest.mock import patch

from crm_lead_presales import advance_presales_stage, ensure_schema
from crm_lead_presales_sla import (
    CONSULT_PROPOSAL_SLA_HOURS,
    build_presales_consult_proposal_sla,
    get_presales_consult_sla_summary,
    is_consult_to_proposal_within_48h,
)


class TestPresalesConsultSla(unittest.TestCase):
    def test_build_sla_breach(self) -> None:
        now = datetime(2026, 8, 5, 12, 0, 0)
        started = datetime(2026, 8, 1, 10, 0, 0)
        sla = build_presales_consult_proposal_sla(
            presales_stage="consult",
            consult_entered_at=started.strftime("%Y-%m-%d %H:%M:%S"),
            stage_entered_at=started.strftime("%Y-%m-%d %H:%M:%S"),
            now=now,
        )
        self.assertEqual(sla["sla_state"], "breach")

    def test_within_48h_handoff(self) -> None:
        self.assertTrue(
            is_consult_to_proposal_within_48h(
                "2026-08-01 10:00:00",
                "2026-08-02 09:00:00",
            )
        )
        self.assertFalse(
            is_consult_to_proposal_within_48h(
                "2026-08-01 10:00:00",
                "2026-08-04 10:00:00",
            )
        )

    @patch(
        "crm_lead_presales_marketing_plan.validate_presales_proposal_advance",
        return_value={"ok": True},
    )
    def test_advance_sets_timestamps(self, _mock_gate) -> None:
        conn = sqlite3.connect(":memory:")
        conn.row_factory = sqlite3.Row
        ensure_schema(conn)
        conn.execute(
            "CREATE TABLE crm_leads (id INTEGER PRIMARY KEY, owner_id INTEGER, status TEXT, created_at TEXT, updated_at TEXT)"
        )
        conn.execute(
            """
            INSERT INTO crm_leads (id, owner_id, status, created_at, updated_at)
            VALUES (1, 1, 'moi', '2026-01-01', '2026-01-01')
            """
        )
        conn.execute(
            """
            INSERT INTO crm_lead_presales
            (id, lead_id, service_slug, stage, status, stage_entered_at,
             consult_entered_at, proposal_entered_at, notes, created_at, updated_at)
            VALUES (1, 1, 'lead-gen', 'consult', 'active', '2026-08-01 10:00:00',
                    '', '', '', '2026-08-01', '2026-08-01')
            """
        )
        conn.execute(
            """
            INSERT INTO crm_lead_presales_tasks
            (id, presales_id, stage, step_index, title, description,
             form_fields, form_data, is_done, created_at, updated_at)
            VALUES (1, 1, 'consult', 0, 'Consult', '', '[]', '{}', 1, '2026-08-01', '2026-08-01')
            """
        )
        conn.commit()

        advance_presales_stage(conn, 1, "proposal")
        row = conn.execute(
            "SELECT consult_entered_at, proposal_entered_at FROM crm_lead_presales WHERE id = 1"
        ).fetchone()
        self.assertEqual(str(row[0]), "2026-08-01 10:00:00")
        self.assertNotEqual(str(row[1]), "")

    def test_summary_dashboard(self) -> None:
        conn = sqlite3.connect(":memory:")
        conn.row_factory = sqlite3.Row
        ensure_schema(conn)
        conn.execute(
            "CREATE TABLE crm_leads (id INTEGER PRIMARY KEY, owner_id INTEGER)"
        )
        conn.execute("INSERT INTO crm_leads (id, owner_id) VALUES (1, 1), (2, 1)")
        conn.execute(
            """
            INSERT INTO crm_lead_presales
            (id, lead_id, service_slug, stage, status, stage_entered_at,
             consult_entered_at, proposal_entered_at, notes, created_at, updated_at)
            VALUES
              (1, 1, 'lead-gen', 'consult', 'active',
               datetime('now', '-10 hours'), datetime('now', '-10 hours'), '', '', '2026-08-01', '2026-08-01'),
              (2, 2, 'lead-gen', 'proposal', 'active',
               '2026-08-01', '2026-08-01 10:00:00', '2026-08-01 20:00:00', '', '2026-08-01', '2026-08-01')
            """
        )
        conn.commit()
        summary = get_presales_consult_sla_summary(conn)
        self.assertEqual(summary["active_consult"], 1)
        self.assertEqual(summary["consult_to_proposal_48h_num"], 1)
        self.assertEqual(summary["consult_to_proposal_48h_denom"], 1)

    def test_sla_hours_constant(self) -> None:
        self.assertEqual(CONSULT_PROPOSAL_SLA_HOURS, 48)


if __name__ == "__main__":
    unittest.main()
