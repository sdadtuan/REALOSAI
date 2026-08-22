"""Gate hoàn thành task Consult — form 100% + AI assist khi có prompt."""
from __future__ import annotations

from typing import Any


def validate_presales_consult_task_done(
    *,
    stage: str,
    ai_prompt_key: str | None,
    ai_output: str | None,
    form_fields: list[dict[str, Any]] | None,
    form_data: dict[str, Any],
) -> tuple[bool, str]:
    fields = form_fields or []
    missing: list[str] = []
    for field in fields:
        if field.get("required") is False:
            continue
        key = str(field.get("key") or "").strip()
        if not key:
            continue
        val = form_data.get(key)
        if val is None or str(val).strip() == "":
            missing.append(str(field.get("label") or key))
    if missing:
        return False, f"Điền đủ trường trước khi hoàn thành task: {', '.join(missing)}"

    if str(stage or "").strip() != "consult":
        return True, ""

    prompt_key = str(ai_prompt_key or "").strip()
    ai_text = str(ai_output or "").strip()
    if prompt_key and not ai_text:
        return (
            False,
            "Chạy AI Hỗ trợ trước khi ✓ task Consult — bắt buộc QC agency khi task có consult_analysis.",
        )
    return True, ""


def assert_presales_consult_task_done(**kwargs: Any) -> None:
    ok, message = validate_presales_consult_task_done(**kwargs)
    if not ok:
        raise ValueError(message)
