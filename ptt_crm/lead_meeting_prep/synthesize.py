"""Single-shot LLM synthesize — S-LMP-1b."""
from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from ptt_crm.lead_meeting_prep import schema, spc_catalog, close_intelligence
from ptt_crm.lead_meeting_prep import stub_synthesize
from ptt_crm import lmp_llm_client

PROMPT_VERSION = "lmp-synth-v1"
ROOT = Path(__file__).resolve().parents[2]


def _load_system_prompt() -> str:
    path = ROOT / "docs" / "prompts" / "lmp" / "lmp-synth-v1.system.md"
    if path.is_file():
        return path.read_text(encoding="utf-8")
    return "Return JSON LeadMeetingPrepResult for sales call prep."


def _summarize_sources(collect: dict[str, Any], limit: int = 6) -> str:
    lines: list[str] = []
    for doc in (collect.get("company_sources") or [])[:limit]:
        if not isinstance(doc, dict):
            continue
        url = doc.get("url") or ""
        title = doc.get("title") or url
        snippet = str(doc.get("content") or "")[:1200]
        lines.append(f"- [{title}]({url})\n{snippet}")
    return "\n\n".join(lines) if lines else "(Không có nguồn Tavily — dùng thông tin lead.)"


def build_user_prompt(
    inp: dict[str, Any],
    collect: dict[str, Any],
    catalog: list[dict[str, str]],
    *,
    verify_website: dict[str, Any] | None,
    prep_stage: str,
) -> str:
    catalog_lines = [
        f"- {r['dv_code']}: {r['name_vi']} ({r.get('department') or ''})" for r in catalog[:21]
    ]
    website_block = json.dumps(verify_website or {}, ensure_ascii=False)
    return (
        f"prep_stage: {prep_stage}\n\n"
        f"## Lead input\n{json.dumps(inp, ensure_ascii=False, indent=2)}\n\n"
        f"## Verified website\n{website_block}\n\n"
        f"## Public sources\n{_summarize_sources(collect)}\n\n"
        f"## SPC catalog (chọn tối đa 3 DV)\n" + "\n".join(catalog_lines)
    )


def build_stub_llm_result(
    inp: dict[str, Any],
    collect: dict[str, Any],
    *,
    verify_website: dict[str, Any] | None,
    prep_stage: str,
) -> dict[str, Any]:
    base = stub_synthesize.build_stub_result(inp, collect)
    if verify_website and verify_website.get("url"):
        base["website"] = verify_website
    base["meta"]["prompt_version"] = PROMPT_VERSION
    base["meta"]["prep_stage"] = prep_stage
    base["meta"]["model"] = base["meta"].get("model") or "stub"
    return schema.enforce_contact_policy(base)


def synthesize_prep(
    inp: dict[str, Any],
    collect: dict[str, Any],
    *,
    verify_website: dict[str, Any] | None = None,
    prep_stage: str = "m1_first_strike",
    correlation_id: str | None = None,
) -> dict[str, Any]:
    catalog = spc_catalog.load_published_dv()
    allowed = spc_catalog.dv_code_set(catalog)
    system_prompt = _load_system_prompt()
    user_prompt = build_user_prompt(
        inp, collect, catalog, verify_website=verify_website, prep_stage=prep_stage
    )

    llm_out = lmp_llm_client.complete_synthesize(
        lead_id=int(inp.get("lead_id") or 0),
        client_id=str(inp.get("client_id") or "") or None,
        system_prompt=system_prompt,
        user_prompt=user_prompt,
        prompt_version=PROMPT_VERSION,
        prep_stage=prep_stage,
        stub_json=lambda: build_stub_llm_result(
            inp, collect, verify_website=verify_website, prep_stage=prep_stage
        ),
        correlation_id=correlation_id,
    )

    if not llm_out.get("ok"):
        result = build_stub_llm_result(inp, collect, verify_website=verify_website, prep_stage=prep_stage)
        validated = schema.validate_prep_result(result, allowed_dv_codes=allowed, prep_stage=prep_stage)
        enriched = close_intelligence.enrich_close_intelligence(
            validated,
            inp,
            {**collect, "verify_website_confidence": (verify_website or {}).get("confidence")},
            prep_stage=prep_stage,
            correlation_id=correlation_id,
        )
        return {
            "result": validated,
            "ai_run_id": None,
            "model": "stub-fallback",
            "stub_mode": True,
            "llm_error": llm_out.get("error"),
            "readiness_score": enriched["readiness_score"],
            "readiness_breakdown": enriched.get("readiness_breakdown"),
        }

    parsed = llm_out.get("parsed") or {}
    if verify_website and verify_website.get("url"):
        parsed["website"] = verify_website

    meta = parsed.get("meta") if isinstance(parsed.get("meta"), dict) else {}
    meta.setdefault("researched_at", datetime.now(timezone.utc).isoformat())
    meta.setdefault("sources_count", len(collect.get("company_sources") or []))
    meta["prompt_version"] = PROMPT_VERSION
    meta["prep_stage"] = prep_stage
    meta["tavily_credits_used"] = int(collect.get("credits_used") or 0)
    meta["partial_collect"] = bool(collect.get("partial") or collect.get("stub"))
    meta["model"] = str(llm_out.get("model_name") or meta.get("model") or "unknown")
    parsed["meta"] = meta

    validated = schema.validate_prep_result(parsed, allowed_dv_codes=allowed, prep_stage=prep_stage)

    sku_codes: set[str] = set()
    try:
        from ptt_jobs.db import pg_available, pg_connection

        if pg_available():
            with pg_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        "SELECT sku_code FROM spc_offer WHERE status = 'published' AND active = true"
                    )
                    sku_codes = {str(r[0]).upper() for r in cur.fetchall()}
    except Exception:
        pass

    enriched = close_intelligence.enrich_close_intelligence(
        validated,
        inp,
        {**collect, "verify_website_confidence": (verify_website or {}).get("confidence")},
        prep_stage=prep_stage,
        correlation_id=correlation_id,
        allowed_sku_codes=sku_codes or None,
    )
    readiness = enriched["readiness_score"]

    return {
        "result": validated,
        "ai_run_id": llm_out.get("ai_run_id"),
        "model": meta["model"],
        "stub_mode": bool(llm_out.get("stub_mode")),
        "readiness_score": readiness,
        "readiness_breakdown": enriched.get("readiness_breakdown"),
    }
