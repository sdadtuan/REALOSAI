"""Tests RNOS-33 — MCP-style AI tools gate artifacts."""

from __future__ import annotations

import re
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class TestRnos33AiTools(unittest.TestCase):
    def test_gate_artifacts_present(self):
        required = [
            "docs/specs/2026-07-27-postgresql-ddl-rnos33-ai-tools.sql",
            "services/ptt-crm-api/src/ai-intelligence/ai-tools/tool.registry.ts",
            "services/ptt-crm-api/src/ai-intelligence/ai-tools/ai-tools.service.ts",
            "services/ptt-crm-api/src/ai-intelligence/ai-tools/ai-tools.controller.ts",
            "services/ptt-crm-api/src/ai-intelligence/ai-tools/ai-tool-api-key.guard.ts",
            "services/ptt-crm-api/src/ai-intelligence/ai-tools/ai-tool-keys.repository.ts",
            "services/ops-web/src/app/admin/ai/tools/page.tsx",
            "services/ops-web/src/components/ai/AiToolKeysPanel.tsx",
            "services/ops-web/e2e/ai-tools-rnos33.spec.ts",
            "scripts/playwright_ops_ai_tools_e2e.sh",
            "scripts/rnos33_ai_tools_gate.sh",
        ]
        for rel in required:
            with self.subTest(artifact=rel):
                self.assertTrue((ROOT / rel).is_file(), rel)

    def test_external_api_is_scoped_revocable_and_audited(self):
        controller = (
            ROOT
            / "services/ptt-crm-api/src/ai-intelligence/ai-tools/ai-tools.controller.ts"
        ).read_text(encoding="utf-8")
        guard = (
            ROOT
            / "services/ptt-crm-api/src/ai-intelligence/ai-tools/ai-tool-api-key.guard.ts"
        ).read_text(encoding="utf-8")
        repository = (
            ROOT
            / "services/ptt-crm-api/src/ai-intelligence/ai-tools/ai-tool-keys.repository.ts"
        ).read_text(encoding="utf-8")
        registry = (
            ROOT
            / "services/ptt-crm-api/src/ai-intelligence/ai-tools/tool.registry.ts"
        ).read_text(encoding="utf-8")
        service = (
            ROOT
            / "services/ptt-crm-api/src/ai-intelligence/ai-tools/ai-tools.service.ts"
        ).read_text(encoding="utf-8")

        self.assertIn("@Get('api/v1/ai/tools')", controller)
        self.assertIn("@Post('api/v1/ai/tools/call')", controller)
        self.assertIn("'x-ai-tool-key'", guard)
        self.assertIn("allowed_tools.includes(name)", registry)
        self.assertRegex(repository, r"is_active\s*=\s*false")
        self.assertRegex(repository, r"revoked_at\s*=\s*NOW\(\)")
        self.assertIn("AI_USE_CASE.TOOL_CALL", registry)
        self.assertIn("this.audit.wrap", registry)
        self.assertIn("this.keys.recordCall", service)
        self.assertIn("agentRunId: callResult.runId", service)

    def test_catalog_is_mcp_shaped_and_avoids_raw_input_in_audit_metadata(self):
        types = (
            ROOT
            / "services/ptt-crm-api/src/ai-intelligence/ai-tools/ai-tools.types.ts"
        ).read_text(encoding="utf-8")
        registry = (
            ROOT
            / "services/ptt-crm-api/src/ai-intelligence/ai-tools/tool.registry.ts"
        ).read_text(encoding="utf-8")
        tools_dir = ROOT / "services/ptt-crm-api/src/ai-intelligence/ai-tools/tools"
        tool_sources = "\n".join(
            path.read_text(encoding="utf-8") for path in tools_dir.glob("*.tool.ts")
        )

        for field in ("name", "description", "inputSchema", "mutating", "requiredCaps"):
            with self.subTest(descriptor_field=field):
                self.assertRegex(types, rf"\b{field}\??:")
        for tool_name in (
            "score_lead",
            "route_lead",
            "list_leads",
            "get_lead",
            "get_forecast_snapshot",
            "suggest_upsell",
            "get_anomaly_digest",
            "run_orchestration",
            "list_orchestrations",
            "health_check",
        ):
            with self.subTest(tool=tool_name):
                self.assertRegex(tool_sources, rf"name:\s*['\"]{tool_name}['\"]")
        self.assertIn("input: { tool_name: toolName }", registry)
        self.assertNotIn("input: input", registry)

    def test_flag_uat_and_gate_count_are_documented(self):
        env = (ROOT / "deploy/env.staging-phase3.example").read_text(encoding="utf-8")
        actions = (
            ROOT / "docs/use-cases/actions/09-AI-ACTIONS.md"
        ).read_text(encoding="utf-8")
        gate = (ROOT / "scripts/rnos33_ai_tools_gate.sh").read_text(encoding="utf-8")

        self.assertIn("PTT_AI_TOOLS_API_ENABLED=1", env)
        self.assertIn("## AI-UC-022", actions)
        self.assertRegex(actions, r"\|\s*\*\*R4\*\*\s*\|[^\n]*022")
        self.assertGreaterEqual(len(re.findall(r"\blog_ok\s+", gate)), 18)


if __name__ == "__main__":
    unittest.main()
