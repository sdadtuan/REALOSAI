"""Tests RNOS-28 — channel anomaly narrative digest gate artifacts."""

from __future__ import annotations

import unittest
from pathlib import Path


class TestRnos28AnomalyDigest(unittest.TestCase):
    def test_gate_artifacts_present(self):
        root = Path(__file__).resolve().parents[1]
        required = [
            "services/ptt-crm-api/src/ai-intelligence/channel-anomaly.engine.ts",
            "services/ptt-crm-api/src/ai-intelligence/anomaly-digest.service.ts",
            "services/ops-web/src/components/ai/AnomalyDigestBanner.tsx",
            "services/ops-web/e2e/anomaly-digest-rnos28.spec.ts",
            "scripts/rnos28_anomaly_digest_gate.sh",
        ]
        for rel in required:
            self.assertTrue((root / rel).is_file(), rel)

    def test_coach_digest_has_channel_card(self):
        engine = (
            Path(__file__).resolve().parents[1]
            / "services/ptt-crm-api/src/ai-intelligence/coach-digest.engine.ts"
        ).read_text(encoding="utf-8")
        self.assertIn("buildChannelAnomalyCard", engine)


if __name__ == "__main__":
    unittest.main()
