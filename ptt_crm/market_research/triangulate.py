"""Dual Tavily triangulation — basic + advanced as two providers (M6).

Never inserts insights (BR-RES-06 / BR-RES-08).
"""
from __future__ import annotations

import json
import logging
import urllib.error
from datetime import datetime, timezone
from typing import Any

from ptt_crm.market_research import repository
from ptt_crm.market_research.desk_collect import (
    _credits_limit,
    _domain_from_url,
    _search,
    _tavily_key,
    build_desk_query,
)
from ptt_crm.market_research.deep_research import _search_advanced

logger = logging.getLogger(__name__)


def overlap_urls(a: list[str], b: list[str]) -> set[str]:
    norm = lambda u: (u or "").strip().rstrip("/").lower()
    return {norm(x) for x in a if norm(x)} & {norm(x) for x in b if norm(x)}


def _search_basic(
    query: str,
    *,
    api_key: str,
    max_results: int = 5,
) -> tuple[list[dict[str, Any]], int]:
    return _search(query, api_key=api_key, max_results=max_results)


def _norm_url(url: str) -> str:
    return (url or "").strip().rstrip("/").lower()


def _docs_to_sources(docs: list[dict[str, Any]], provider: str) -> list[dict[str, Any]]:
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
                "provider": provider,
            }
        )
    return sources


def collect_triangulate(
    *,
    question_vi: str,
    geo: list[str] | None = None,
    credits_already_used: int = 0,
) -> dict[str, Any]:
    """
    Two Tavily searches (basic = provider_a, advanced = provider_b).

    Honors MAX_TAVILY_CREDITS_PER_RESEARCH before each call.
    Query = question_vi + geo only (BR-RES-11). Never inserts insights.
    """
    limit = _credits_limit()
    remaining = limit - max(0, int(credits_already_used or 0))
    query = build_desk_query(question_vi, geo)
    empty: dict[str, Any] = {
        "ok": False,
        "sources": [],
        "overlap_urls": set(),
        "credits_used": 0,
        "credits_limit": limit,
        "query": query,
        "researched_at": datetime.now(timezone.utc).isoformat(),
    }

    if remaining <= 0:
        return {**empty, "error": "tavily_credit_cap"}

    api_key = _tavily_key()
    if not api_key:
        return {**empty, "error": "tavily_unconfigured"}

    if len(query) < 2:
        return {**empty, "error": "missing_question"}

    credits = 0
    provider_a: list[dict[str, Any]] = []
    provider_b: list[dict[str, Any]] = []

    try:
        docs, cost = _search_basic(query, api_key=api_key)
        credits += cost
        provider_a = _docs_to_sources(docs, "provider_a")
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, OSError) as exc:
        logger.warning("Triangulate Tavily basic failed query=%s: %s", query[:80], exc)
        return {**empty, "error": f"tavily_search_failed: {exc}", "credits_used": credits}

    if credits < remaining:
        try:
            docs, cost = _search_advanced(query, api_key=api_key)
            credits += cost
            provider_b = _docs_to_sources(docs, "provider_b")
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, OSError) as exc:
            logger.warning("Triangulate Tavily advanced failed query=%s: %s", query[:80], exc)
            return {
                **empty,
                "sources": provider_a,
                "overlap_urls": set(),
                "error": f"tavily_search_failed: {exc}",
                "credits_used": credits,
            }

    urls_a = [str(s.get("url") or "") for s in provider_a]
    urls_b = [str(s.get("url") or "") for s in provider_b]
    overlap = overlap_urls(urls_a, urls_b)
    sources = provider_a + provider_b

    return {
        "ok": True,
        "sources": sources,
        "overlap_urls": overlap,
        "credits_used": credits,
        "credits_limit": limit,
        "query": query,
        "researched_at": datetime.now(timezone.utc).isoformat(),
    }


def process_research_triangulate_payload(payload: dict[str, Any]) -> dict[str, Any]:
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
    result = collect_triangulate(
        question_vi=str(ctx.get("question_vi") or ""),
        geo=list(ctx.get("geo") or []),
        credits_already_used=already,
    )
    if not result.get("ok"):
        repository.fail_run(
            run_id,
            str(result.get("error") or "triangulate_failed"),
            credits_used=int(result.get("credits_used") or 0),
        )
        return result

    overlap = { _norm_url(u) for u in (result.get("overlap_urls") or set()) }
    tagged: list[dict[str, Any]] = []
    seen: set[str] = set()
    for src in list(result.get("sources") or []):
        url = str(src.get("url") or "")
        key = _norm_url(url)
        if key and key in seen:
            continue
        if key:
            seen.add(key)
        tagged.append({**src, "triangulated": bool(key and key in overlap)})

    source_ids = repository.insert_ai_sources(
        project_id=project_id,
        question_id=question_id,
        sources=tagged,
        geo=ctx.get("geo"),
    )
    repository.succeed_run(
        run_id,
        credits_used=int(result.get("credits_used") or 0),
        output={
            "query": result.get("query"),
            "source_ids": source_ids,
            "overlap_urls": sorted(overlap),
            "credits_used": result.get("credits_used"),
            "note": "sources_only",
        },
    )
    return {**result, "source_ids": source_ids, "ok": True}
