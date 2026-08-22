"""HTTP client — Python worker → Nest internal LMP LLM endpoint."""
from __future__ import annotations

import json
import logging
import os
import urllib.error
import urllib.request
from typing import Any, Callable

logger = logging.getLogger(__name__)


def _crm_api_base_url() -> str:
    return (
        os.environ.get("PTT_CRM_API_URL")
        or os.environ.get("PTT_NEST_LEADS_URL")
        or os.environ.get("CRM_API_URL")
        or "http://127.0.0.1:3000"
    ).rstrip("/")


def _internal_key() -> str:
    return (os.environ.get("PTT_CRM_INTERNAL_KEY") or "").strip()


def complete_synthesize(
    *,
    lead_id: int,
    client_id: str | None,
    system_prompt: str,
    user_prompt: str,
    prompt_version: str,
    prep_stage: str,
    stub_json: Callable[[], dict[str, Any]],
    correlation_id: str | None = None,
    timeout_sec: float = 120.0,
) -> dict[str, Any]:
    """
    POST /api/v1/internal/lmp/llm-complete

    Falls back to local stub_json when internal key missing or HTTP error.
    """
    key = _internal_key()
    if not key:
        logger.warning("lmp_llm_client: missing PTT_CRM_INTERNAL_KEY — local stub")
        return {
            "ok": True,
            "parsed": stub_json(),
            "ai_run_id": None,
            "model_name": "local-stub",
            "stub_mode": True,
        }

    body = {
        "lead_id": int(lead_id),
        "client_id": client_id,
        "system_prompt": system_prompt,
        "user_prompt": user_prompt,
        "prompt_version": prompt_version,
        "prep_stage": prep_stage,
        "stub_fallback": stub_json(),
    }
    headers = {
        "Content-Type": "application/json",
        "x-ptt-internal-key": key,
    }
    if correlation_id:
        headers["x-correlation-id"] = correlation_id

    req = urllib.request.Request(
        f"{_crm_api_base_url()}/api/v1/internal/lmp/llm-complete",
        data=json.dumps(body).encode("utf-8"),
        headers=headers,
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=timeout_sec) as resp:
            raw = resp.read().decode("utf-8")
            parsed = json.loads(raw) if raw else {}
            if parsed.get("ok") and isinstance(parsed.get("result"), dict):
                return {
                    "ok": True,
                    "parsed": parsed["result"],
                    "ai_run_id": parsed.get("ai_run_id"),
                    "model_name": parsed.get("model_name"),
                    "stub_mode": bool(parsed.get("stub_mode")),
                }
            return {
                "ok": False,
                "error": parsed.get("error") or "invalid_response",
                "detail": parsed,
            }
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        logger.warning("lmp llm-complete HTTP %s: %s", exc.code, detail[:500])
        return {
            "ok": True,
            "parsed": stub_json(),
            "ai_run_id": None,
            "model_name": "stub-http-error",
            "stub_mode": True,
            "error": f"http_{exc.code}",
        }
    except Exception as exc:
        logger.warning("lmp llm-complete failed: %s", exc)
        return {
            "ok": True,
            "parsed": stub_json(),
            "ai_run_id": None,
            "model_name": "stub-exception",
            "stub_mode": True,
            "error": str(exc),
        }
