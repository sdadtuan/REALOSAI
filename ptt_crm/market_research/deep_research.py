"""Deep Research — Tavily advanced fallback; sources + outline only (M5).

Never inserts insights (BR-RES-08 / BR-RES-06).
"""
from __future__ import annotations

import json
import logging
import os
import urllib.error
from datetime import datetime, timezone
from typing import Any

from ptt_crm.market_research import repository
from ptt_crm.market_research.desk_collect import (
    TAVILY_SEARCH_URL,
    _credits_limit,
    _domain_from_url,
    _post_json,
    _tavily_key,
    build_desk_query,
)

logger = logging.getLogger(__name__)


def _configured_provider() -> str:
    return (os.environ.get("RESEARCH_DEEP_PROVIDER") or "openai").strip().lower() or "openai"


def fallback_provider_label(raw: str | None = None) -> str:
    name = (raw or _configured_provider()).strip().lower()
    if name == "gemini":
        return "gemini_fallback_tavily"
    return "openai_fallback_tavily"


def _timeout_sec() -> float:
    try:
        return max(60.0, float(os.environ.get("RESEARCH_DEEP_TIMEOUT_SEC") or 900))
    except ValueError:
        return 900.0


def _search_advanced(
    query: str,
    *,
    api_key: str,
    max_results: int = 8,
    timeout_sec: float = 60.0,
) -> tuple[list[dict[str, Any]], int]:
    body = {
        "api_key": api_key,
        "query": query,
        "search_depth": "advanced",
        "max_results": max_results,
        "include_answer": False,
    }
    data = _post_json(TAVILY_SEARCH_URL, body, timeout_sec=timeout_sec)
    results = data.get("results") or []
    docs: list[dict[str, Any]] = []
    for row in results[:max_results]:
        if not isinstance(row, dict):
            continue
        url = str(row.get("url") or "").strip()
        if not url:
            continue
        docs.append(
            {
                "title": str(row.get("title") or "")[:500],
                "url": url,
                "content": str(row.get("content") or "")[:8000],
                "sourceType": "search",
            }
        )
    return docs, 1


def build_outline(question_vi: str, sources: list[dict[str, Any]]) -> dict[str, Any]:
    """Short source outline only — not findings, not insights, not audited figures."""
    sections: list[dict[str, str]] = []
    for src in sources:
        heading = str(src.get("title") or src.get("url") or "").strip()
        url = str(src.get("url") or "").strip()
        if not heading:
            continue
        sections.append({"heading": heading[:240], "source_url": url})
    return {
        "kind": "source_outline",
        "question": str(question_vi or "").strip()[:500],
        "note": "Candidate sources and outline only. Not audited figures. No insights.",
        "sections": sections,
    }


def collect_deep(
    *,
    question_vi: str,
    geo: list[str] | None = None,
    credits_already_used: int = 0,
) -> dict[str, Any]:
    """
    Tavily advanced search → candidate sources + outline JSON.

    Prompt constraint (BR-RES-11): query = question_vi + geo only, PII stripped.
    Does not invent statistics and does not emit insights.
    """
    limit = _credits_limit()
    remaining = limit - max(0, int(credits_already_used or 0))
    query = build_desk_query(question_vi, geo)
    provider = fallback_provider_label()
    empty: dict[str, Any] = {
        "ok": False,
        "sources": [],
        "outline": build_outline(question_vi, []),
        "credits_used": 0,
        "credits_limit": limit,
        "query": query,
        "provider": provider,
        "researched_at": datetime.now(timezone.utc).isoformat(),
    }

    if remaining <= 0:
        return {**empty, "error": "tavily_credit_cap"}

    api_key = _tavily_key()
    if not api_key:
        return {**empty, "error": "tavily_unconfigured"}

    if len(query) < 2:
        return {**empty, "error": "missing_question"}

    timeout_sec = min(_timeout_sec(), 120.0)
    try:
        docs, credits = _search_advanced(query, api_key=api_key, timeout_sec=timeout_sec)
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, OSError) as exc:
        logger.warning("Deep Tavily advanced failed query=%s: %s", query[:80], exc)
        return {**empty, "error": f"tavily_search_failed: {exc}"}

    sources: list[dict[str, Any]] = []
    seen: set[str] = set()
    for doc in docs[:12]:
        url = str(doc.get("url") or "")
        if not url or url in seen:
            continue
        seen.add(url)
        sources.append(
            {
                "title": str(doc.get("title") or url)[:500] or url,
                "url": url,
                "publisher": _domain_from_url(url) or None,
                "excerpt": str(doc.get("content") or "")[:2000],
                "source_type": "web",
                "ai_generated": True,
            }
        )

    return {
        "ok": True,
        "sources": sources,
        "outline": build_outline(question_vi, sources),
        "credits_used": credits,
        "query": query,
        "provider": provider,
        "researched_at": datetime.now(timezone.utc).isoformat(),
    }


def process_research_deep_payload(payload: dict[str, Any]) -> dict[str, Any]:
    project_id = int(payload.get("project_id") or 0)
    question_id = int(payload.get("question_id") or 0)
    run_id = int(payload.get("run_id") or 0)
    if project_id <= 0 or question_id <= 0 or run_id <= 0:
        return {"ok": False, "error": "invalid_payload"}

    ctx = repository.load_desk_context(project_id, question_id)
    if not ctx:
        repository.fail_run(run_id, "not_found")
        return {"ok": False, "error": "not_found"}

    repository.mark_run_running(run_id)
    already = repository.sum_project_tavily_credits(project_id, exclude_run_id=run_id)
    result = collect_deep(
        question_vi=str(ctx.get("question_vi") or ""),
        geo=list(ctx.get("geo") or []),
        credits_already_used=already,
    )
    if not result.get("ok"):
        repository.fail_run(
            run_id,
            str(result.get("error") or "deep_failed"),
            credits_used=int(result.get("credits_used") or 0),
        )
        return result

    source_ids = repository.insert_ai_sources(
        project_id=project_id,
        question_id=question_id,
        sources=list(result.get("sources") or []),
        geo=ctx.get("geo"),
    )
    provider = str(result.get("provider") or fallback_provider_label())
    repository.set_run_provider(run_id, provider)
    repository.succeed_run(
        run_id,
        credits_used=int(result.get("credits_used") or 0),
        output={
            "query": result.get("query"),
            "source_ids": source_ids,
            "outline": result.get("outline"),
            "provider": provider,
            "note": "sources_and_outline_only",
        },
    )
    return {**result, "source_ids": source_ids, "ok": True}
