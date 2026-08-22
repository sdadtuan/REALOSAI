"""Tests RNOS-22 — curated NL query gate artifacts."""

from __future__ import annotations

import unittest
from pathlib import Path


class TestRnos22NlQuery(unittest.TestCase):
    def test_gate_artifacts_present(self):
        root = Path(__file__).resolve().parents[1]
        required = [
            "services/ptt-crm-api/src/ai-intelligence/nl-query.catalog.ts",
            "services/ptt-crm-api/src/ai-intelligence/ai-nl-query.service.ts",
            "services/ops-web/src/app/crm/ai/query/page.tsx",
            "services/ops-web/e2e/nl-query-rnos22.spec.ts",
            "scripts/rnos22_nl_query_gate.sh",
        ]
        for rel in required:
            self.assertTrue((root / rel).is_file(), rel)

    def test_catalog_has_cpl_intent(self):
        catalog = (
            Path(__file__).resolve().parents[1]
            / "services/ptt-crm-api/src/ai-intelligence/nl-query.catalog.ts"
        ).read_text(encoding="utf-8")
        self.assertIn("cpl_meta_t30_overview", catalog)
        self.assertIn("CPL Meta T-30", catalog)


if __name__ == "__main__":
    unittest.main()
