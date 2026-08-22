"""Tests RNOS-26 — Lead Routing Agent v1 gate artifacts."""

from __future__ import annotations

import unittest
from pathlib import Path


class TestRnos26LeadRouting(unittest.TestCase):
    def test_gate_artifacts_present(self):
        root = Path(__file__).resolve().parents[1]
        required = [
            "services/ptt-crm-api/src/ai-intelligence/lead-route.engine.ts",
            "services/ptt-crm-api/src/ai-intelligence/ai-lead-route.service.ts",
            "services/ops-web/src/components/ai/LeadRouteRepSection.tsx",
            "services/ops-web/e2e/lead-routing-rnos26.spec.ts",
            "scripts/rnos26_lead_routing_gate.sh",
        ]
        for rel in required:
            self.assertTrue((root / rel).is_file(), rel)

    def test_copilot_wires_route_section(self):
        panel = (
            Path(__file__).resolve().parents[1]
            / "services/ops-web/src/components/ai/LeadCopilotPanel.tsx"
        ).read_text(encoding="utf-8")
        self.assertIn("LeadRouteRepSection", panel)


if __name__ == "__main__":
    unittest.main()
