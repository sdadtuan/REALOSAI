"""Tests consult task completion gate."""
from __future__ import annotations

import unittest

from crm_lead_presales_consult_gate import (
    assert_presales_consult_task_done,
    validate_presales_consult_task_done,
)


class TestPresalesConsultGate(unittest.TestCase):
    def test_requires_ai_when_prompt_set(self) -> None:
        ok, msg = validate_presales_consult_task_done(
            stage="consult",
            ai_prompt_key="consult_analysis",
            ai_output="",
            form_fields=[{"key": "niche", "label": "Ngành", "required": True}],
            form_data={"niche": "Spa"},
        )
        self.assertFalse(ok)
        self.assertIn("AI Hỗ trợ", msg)

    def test_allows_with_ai_output(self) -> None:
        ok, _ = validate_presales_consult_task_done(
            stage="consult",
            ai_prompt_key="consult_analysis",
            ai_output="Done",
            form_fields=[{"key": "niche", "label": "Ngành", "required": True}],
            form_data={"niche": "Spa"},
        )
        self.assertTrue(ok)

    def test_assert_raises(self) -> None:
        with self.assertRaises(ValueError):
            assert_presales_consult_task_done(
                stage="consult",
                ai_prompt_key="consult_analysis",
                ai_output="",
                form_fields=[],
                form_data={},
            )


if __name__ == "__main__":
    unittest.main()
