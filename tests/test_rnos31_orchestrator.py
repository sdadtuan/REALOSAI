"""Tests RNOS-31 — multi-agent orchestrator gate artifacts."""

from __future__ import annotations

import re
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class TestRnos31Orchestrator(unittest.TestCase):
    def test_gate_artifacts_present(self):
        required = [
            "services/ptt-crm-api/src/ai-intelligence/orchestrator/orchestrator.engine.ts",
            "services/ptt-crm-api/src/ai-intelligence/orchestrator/orchestrator.service.ts",
            "services/ptt-crm-api/src/ai-intelligence/orchestrator/agent.registry.ts",
            "services/ptt-crm-api/src/ai-intelligence/orchestrator/plans/lead-intake.plan.ts",
            "services/ops-web/src/app/admin/ai/agents/page.tsx",
            "services/ops-web/src/components/ai/AgentRunTree.tsx",
            "services/ops-web/e2e/orchestrator-rnos31.spec.ts",
            "scripts/playwright_ops_orchestrator_e2e.sh",
            "scripts/rnos31_orchestrator_gate.sh",
        ]
        for rel in required:
            with self.subTest(artifact=rel):
                self.assertTrue((ROOT / rel).is_file(), rel)

    def test_engine_imports_and_registers_static_plan_keys(self):
        engine = (
            ROOT
            / "services/ptt-crm-api/src/ai-intelligence/orchestrator/orchestrator.engine.ts"
        ).read_text(encoding="utf-8")
        plans = {
            "LEAD_INTAKE_PLAN": "lead_intake_v1",
            "RETAIN_HEALTH_PLAN": "retain_health_renewal_v1",
            "RETAIN_HEALTH_CLIENT_PLAN": "retain_health_client_v1",
        }
        for constant, plan_key in plans.items():
            with self.subTest(plan=plan_key):
                self.assertRegex(engine, rf"import\s+\{{\s*{constant}\s*\}}")
                self.assertIn(f"[{constant}.key, {constant}]", engine)
                plan_files = list(
                    (ROOT / "services/ptt-crm-api/src/ai-intelligence/orchestrator/plans").glob(
                        "*.plan.ts"
                    )
                )
                self.assertTrue(
                    any(
                        re.search(rf"key:\s*['\"]{re.escape(plan_key)}['\"]", path.read_text())
                        for path in plan_files
                    ),
                    plan_key,
                )

    def test_audit_flags_and_uat_actions_are_documented(self):
        audit = (
            ROOT / "services/ptt-crm-api/src/ai-intelligence/ai-audit.constants.ts"
        ).read_text(encoding="utf-8")
        env = (ROOT / "deploy/env.staging-phase3.example").read_text(encoding="utf-8")
        actions = (
            ROOT / "docs/use-cases/actions/09-AI-ACTIONS.md"
        ).read_text(encoding="utf-8")

        self.assertIn("ORCHESTRATION_RUN", audit)
        self.assertIn("ORCHESTRATION_STEP", audit)
        self.assertIn("PTT_AI_ORCHESTRATOR_ENABLED", env)
        self.assertIn("PTT_AI_ORCHESTRATOR_CRON_ENABLED", env)
        self.assertIn("## AI-UC-021", actions)
        self.assertRegex(actions, r"\|\s*\*\*R4\*\*\s*\|[^\n]*021")


if __name__ == "__main__":
    unittest.main()
