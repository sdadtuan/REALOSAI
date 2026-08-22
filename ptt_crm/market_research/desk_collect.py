"""Desk Tavily collect — search + extract with research credit cap (M4)."""
from __future__ import annotations

import json
import logging
import os
import urllib.error
import urllib.request
from datetime import datetime, timezone
from typing import Any
from urllib.parse import urlparse

from ptt_crm.market_research.pii_guard import strip_pii

logger = logging.getLogger(__name__)

TAVILY_SEARCH_URL = "https://api.tavily.com/search"
TAVILY_EXTRACT_URL = "https://api.tavily.com/extract"

def _credits_limit() -> int:
    try:
        return max(1, int(os.environ.get("MAX_TAVILY_CREDITS_PER_RESEARCH", "12") or 12))
    except ValueError:
        return 12


def _tavily_key() -> str:
    return (os.environ.get("TAVILY_API_KEY") or "").strip()


def build_desk_query(question_vi: str, geo: list[str] | None) -> str:
    parts = [str(question_vi or "").strip()]
    for item in geo or []:
        token = str(item or "").strip()
        if token:
            parts.append(token)
    return strip_pii(" ".join(parts))[:500]


def _post_json(url: str, payload: dict[str, Any], *, timeout_sec: float = 30.0) -> dict[str, Any]:
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=timeout_sec) as resp:
        raw = resp.read().decode("utf-8")
        return json.loads(raw) if raw else {}


def _search(query: str, *, api_key: str, max_results: int = 5) -> tuple[list[dict[str, Any]], int]:
    body = {
        "api_key": api_key,
        "query": query,
        "search_depth": "basic",
        "max_results": max_results,
        "include_answer": False,
    }
    data = _post_json(TAVILY_SEARCH_URL, body)
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


def _extract(urls: list[str], *, api_key: str) -> tuple[list[dict[str, Any]], int]:
    if not urls:
        return [], 0
    body = {"api_key": api_key, "urls": urls[:5]}
    data = _post_json(TAVILY_EXTRACT_URL, body, timeout_sec=45.0)
    results = data.get("results") or []
    docs: list[dict[str, Any]] = []
    for row in results:
        if not isinstance(row, dict):
            continue
        url = str(row.get("url") or "").strip()
        if not url:
            continue
        docs.append(
            {
                "title": str(row.get("title") or url)[:500],
                "url": url,
                "content": str(row.get("raw_content") or row.get("content") or "")[:12000],
                "sourceType": "extract",
            }
        )
    return docs, 1


def _domain_from_url(url: str) -> str:
    raw = str(url or "").strip()
    if not raw:
        return ""
    if not raw.startswith(("http://", "https://")):
        raw = f"https://{raw}"
    try:
        host = urlparse(raw).netloc.lower()
        return host[4:] if host.startswith("www.") else host
    except ValueError:
        return ""


def collect_desk(
    *,
    question_vi: str,
    geo: list[str] | None = None,
    credits_already_used: int = 0,
) -> dict[str, Any]:
    """
    Collect public desk sources via Tavily.

    Credit accounting: 1 per search + 1 per extract batch.
    Query = question_vi + geo only (BR-RES-11). Never raises on missing key.
    """
    limit = _credits_limit()
    remaining = limit - max(0, int(credits_already_used or 0))
    query = build_desk_query(question_vi, geo)
    empty: dict[str, Any] = {
        "ok": False,
        "sources": [],
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
    partial = False
    all_docs: list[dict[str, Any]] = []
    seen_urls: set[str] = set()

    def add_docs(docs: list[dict[str, Any]]) -> None:
        for doc in docs:
            url = doc.get("url")
            if not url or url in seen_urls:
                continue
            seen_urls.add(str(url))
            all_docs.append(doc)

    try:
        docs, cost = _search(query, api_key=api_key)
        credits += cost
        add_docs(docs)
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, OSError) as exc:
        logger.warning("Tavily search failed query=%s: %s", query[:80], exc)
        return {**empty, "error": f"tavily_search_failed: {exc}", "credits_used": credits}

    extract_urls = [str(doc["url"]) for doc in all_docs[:5] if doc.get("url")]
    if extract_urls and credits < remaining:
        try:
            extracted, cost = _extract(extract_urls, api_key=api_key)
            credits += cost
            add_docs(extracted)
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, OSError) as exc:
            logger.warning("Tavily extract failed: %s", exc)
            partial = True
    elif extract_urls:
        partial = True

    sources: list[dict[str, Any]] = []
    for doc in all_docs[:12]:
        url = str(doc.get("url") or "")
        sources.append(
            {
                "title": str(doc.get("title") or url)[:500] or url,
                "url": url,
                "publisher": _domain_from_url(url) or None,
                "excerpt": str(doc.get("content") or "")[:2000],
                "source_type": "web",
            }
        )

    return {
        "ok": True,
        "sources": sources,
        "credits_used": credits,
        "credits_limit": limit,
        "query": query,
        "partial": partial or credits >= remaining,
        "researched_at": datetime.now(timezone.utc).isoformat(),
    }


def process_research_desk_payload(payload: dict[str, Any]) -> dict[str, Any]:
    from ptt_crm.market_research import repository

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
    result = collect_desk(
        question_vi=str(ctx.get("question_vi") or ""),
        geo=list(ctx.get("geo") or []),
        credits_already_used=already,
    )
    if not result.get("ok"):
        repository.fail_run(
            run_id,
            str(result.get("error") or "desk_failed"),
            credits_used=int(result.get("credits_used") or 0),
        )
        return result

    source_ids = repository.insert_ai_sources(
        project_id=project_id,
        question_id=question_id,
        sources=list(result.get("sources") or []),
        geo=ctx.get("geo"),
    )
    repository.succeed_run(
        run_id,
        credits_used=int(result.get("credits_used") or 0),
        output={
            "query": result.get("query"),
            "source_ids": source_ids,
            "credits_used": result.get("credits_used"),
            "partial": result.get("partial"),
        },
    )
    return {**result, "source_ids": source_ids, "ok": True}
