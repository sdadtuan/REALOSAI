"""RNOS-01 — Revenue OS AI DDL helpers."""
from __future__ import annotations

import unittest
from unittest.mock import MagicMock, patch


class TestRnos01PgSchema(unittest.TestCase):
    def test_migration_version(self) -> None:
        from ptt_crm.pg_schema import MIGRATION_REVENUE_OS_AI

        self.assertEqual(MIGRATION_REVENUE_OS_AI, "2026-07-26-revenue-os-ai")
        self.assertLessEqual(len(MIGRATION_REVENUE_OS_AI), 64)

    def test_r1_core_tables_subset(self) -> None:
        from ptt_crm.pg_schema import REVENUE_OS_AI_R1_CORE_TABLES, REVENUE_OS_AI_TABLES

        for table in REVENUE_OS_AI_R1_CORE_TABLES:
            self.assertIn(table, REVENUE_OS_AI_TABLES)

    def test_ddl_path_exists(self) -> None:
        from ptt_crm.pg_schema import ddl_revenue_os_ai_path

        path = ddl_revenue_os_ai_path()
        self.assertTrue(path.is_file(), path)

    @patch("ptt_jobs.db.pg_available", return_value=True)
    @patch("ptt_jobs.db.pg_connection")
    def test_prerequisites_ready(self, mock_conn: MagicMock, _pg: object) -> None:
        from ptt_crm.pg_schema import pg_revenue_os_ai_prerequisites_ready

        cursor = MagicMock()
        cursor.fetchone.return_value = (3,)
        mock_conn.return_value.__enter__.return_value.cursor.return_value.__enter__.return_value = cursor

        self.assertTrue(pg_revenue_os_ai_prerequisites_ready())

    @patch("ptt_jobs.db.pg_available", return_value=True)
    @patch("ptt_jobs.db.pg_connection")
    def test_migration_applied(self, mock_conn: MagicMock, _pg: object) -> None:
        from ptt_crm.pg_schema import pg_revenue_os_ai_migration_applied

        cursor = MagicMock()
        cursor.fetchone.return_value = (1,)
        mock_conn.return_value.__enter__.return_value.cursor.return_value.__enter__.return_value = cursor

        self.assertTrue(pg_revenue_os_ai_migration_applied())

    @patch("ptt_crm.pg_schema.pg_revenue_os_ai_migration_applied", return_value=True)
    @patch("ptt_crm.pg_schema._pg_revenue_os_ai_tables_present", return_value=True)
    def test_full_ready(self, _tables: object, _migration: object) -> None:
        from ptt_crm.pg_schema import pg_revenue_os_ai_ready

        self.assertTrue(pg_revenue_os_ai_ready())


if __name__ == "__main__":
    unittest.main()
