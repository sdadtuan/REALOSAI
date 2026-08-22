"""Tests presales L2 docs checklist."""
from __future__ import annotations

import json
import sqlite3
import unittest

from crm_lead_presales import ensure_schema, update_presales_task
from crm_lead_presales_l2 import (
    assert_presales_l2_docs_complete,
    build_presales_l2_docs_view,
    list_presales_l2_catalog,
    merge_presales_l2_docs_patch,
)


class TestPresalesL2Docs(unittest.TestCase):
    def test_catalog_lead_gen(self) -> None:
        items = list_presales_l2_catalog("lead-gen")
        self.assertEqual(len(items), 5)

    def test_build_view_missing(self) -> None:
        view = build_presales_l2_docs_view("dich-vu-seo-tong-the", {"gsc_read": True})
        self.assertFalse(view["complete"])
        self.assertIn("GA4", view["missing_labels"])

    def test_merge_patch_ignores_unknown_keys(self) -> None:
        merged = merge_presales_l2_docs_patch("lead-gen", {}, {"meta_lead_export": True, "bogus": True})
        self.assertEqual(merged, {"meta_lead_export": True})

    def test_assert_complete(self) -> None:
        slug = "dich-vu-aeo"
        stored = {item["key"]: True for item in list_presales_l2_catalog(slug)}
        assert_presales_l2_docs_complete(slug, stored)

    def test_update_consult_task_requires_l2(self) -> None:
        conn = sqlite3.connect(":memory:")
        conn.row_factory = sqlite3.Row
        ensure_schema(conn)
        conn.execute(
            """
            INSERT INTO crm_lead_presales
            (id, lead_id, service_slug, stage, status, stage_entered_at, notes, created_at, updated_at, l2_docs_json)
            VALUES (1, 1, 'lead-gen', 'consult', 'active', '2026-01-01', '', '2026-01-01', '2026-01-01', '{}')
            """
        )
        conn.execute(
            """
            INSERT INTO crm_lead_presales_tasks
            (id, presales_id, stage, step_index, title, description, form_fields, form_data, is_done, created_at, updated_at)
            VALUES (10, 1, 'consult', 0, 'Consult', '', '[]', '{}', 0, '2026-01-01', '2026-01-01')
            """
        )
        conn.commit()
        with self.assertRaises(ValueError) as ctx:
            update_presales_task(conn, 10, is_done=True)
        self.assertIn("L2", str(ctx.exception))
        conn.execute(
            "UPDATE crm_lead_presales SET l2_docs_json = ? WHERE id = 1",
            (
                json.dumps({item["key"]: True for item in list_presales_l2_catalog("lead-gen")}),
            ),
        )
        conn.commit()
        update_presales_task(conn, 10, is_done=True)
        row = conn.execute("SELECT is_done FROM crm_lead_presales_tasks WHERE id = 10").fetchone()
        self.assertEqual(int(row[0]), 1)


if __name__ == "__main__":
    unittest.main()
