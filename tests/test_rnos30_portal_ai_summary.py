"""Tests RNOS-30 — portal AI report summary gate artifacts."""

from __future__ import annotations

import unittest
from pathlib import Path


class TestRnos30PortalAiSummary(unittest.TestCase):
    def test_gate_artifacts_present(self):
        root = Path(__file__).resolve().parents[1]
        required = [
            "services/ptt-crm-api/src/portal-ai/portal-ai-report.controller.ts",
            "services/ptt-crm-api/src/portal-ai/portal-report-summary.engine.ts",
            "services/portal-web/src/components/PortalAiReportSummary.tsx",
            "services/portal-web/e2e/portal-ai-summary-rnos30.spec.ts",
            "scripts/rnos30_portal_ai_summary_gate.sh",
        ]
        for rel in required:
            self.assertTrue((root / rel).is_file(), rel)

    def test_audit_constant_present(self):
        constants = (
            Path(__file__).resolve().parents[1]
            / "services/ptt-crm-api/src/ai-intelligence/ai-audit.constants.ts"
        ).read_text(encoding="utf-8")
        self.assertIn("PORTAL_REPORT_SUMMARY", constants)


if __name__ == "__main__":
    unittest.main()
