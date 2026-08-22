"""Tests RNOS-27 — Upsell Agent gate artifacts."""

from __future__ import annotations

import unittest
from pathlib import Path


class TestRnos27Upsell(unittest.TestCase):
    def test_gate_artifacts_present(self):
        root = Path(__file__).resolve().parents[1]
        required = [
            "services/ptt-crm-api/src/ai-intelligence/upsell.engine.ts",
            "services/ptt-crm-api/src/ai-intelligence/upsell-agent.service.ts",
            "services/ops-web/src/components/ai/UpsellAgentPanel.tsx",
            "services/ops-web/e2e/upsell-rnos27.spec.ts",
            "scripts/rnos27_upsell_gate.sh",
        ]
        for rel in required:
            self.assertTrue((root / rel).is_file(), rel)

    def test_retain_tab_wires_upsell_panel(self):
        page = (
            Path(__file__).resolve().parents[1]
            / "services/ops-web/src/app/agency/clients/[id]/AgencyClientDetailContent.tsx"
        ).read_text(encoding="utf-8")
        self.assertIn("UpsellAgentPanel", page)


if __name__ == "__main__":
    unittest.main()
