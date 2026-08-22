"""Tavily collect — search + extract with credit cap (S-LMP-1b)."""
from __future__ import annotations

import json
import logging
import os
import urllib.error
import urllib.request
from datetime import datetime, timezone
from typing import Any
from urllib.parse import urlparse

from ptt_crm.lead_meeting_prep import repository

logger = logging.getLogger(__name__)

TAVILY_SEARCH_URL = "https://api.tavily.com/search"
TAVILY_EXTRACT_URL = "https://api.tavily.com/extract"


def _credits_limit() -> int:
    try:
        return max(1, int(os.environ.get("MAX_TAVILY_CREDITS_PER_LEAD", "8") or 8))
    except ValueError:
        return 8


def _tavily_key() -> str:
    return (os.environ.get("TAVILY_API_KEY") or "").strip()


def _safe_company_query(company_name: str) -> str:
    """Never include phone/email/contact name in Tavily queries."""
    return " ".join(str(company_name or "").split())[:120]


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


def _stub_collect(inp: dict[str, Any], *, reason: str) -> dict[str, Any]:
    company = inp.get("company_name") or "Doanh nghiệp"
    sources: list[dict[str, Any]] = []
    if inp.get("website_url"):
        sources.append(
            {
                "title": company,
                "url": str(inp["website_url"]),
                "content": f"URL do AM/lead cung cấp: {inp['website_url']}",
                "sourceType": "provided",
            }
        )
    return {
        "company_found": bool(sources),
        "company_sources": sources,
        "credits_used": 0,
        "credits_limit": _credits_limit(),
        "partial": True,
        "researched_at": datetime.now(timezone.utc).isoformat(),
        "stub": True,
        "note": reason,
        "queries": [],
    }


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


def collect_company(inp: dict[str, Any]) -> dict[str, Any]:
    """
    Collect public company research via Tavily.

    Credit accounting: 1 per search branch + 1 per extract batch.
    """
    limit = _credits_limit()
    api_key = _tavily_key()
    company = _safe_company_query(str(inp.get("company_name") or ""))
    if len(company) < 2:
        return _stub_collect(inp, reason="missing_company_name")

    domain = _domain_from_url(str(inp.get("website_url") or ""))
    if domain:
        cached = repository.get_domain_cache(domain)
        if cached:
            cached = {**cached, "cache_hit": True, "cache_domain": domain}
            return cached

    if not api_key:
        return _stub_collect(inp, reason="TAVILY_API_KEY missing — stub collect")

    credits = 0
    partial = False
    queries: list[str] = []
    all_docs: list[dict[str, Any]] = []
    seen_urls: set[str] = set()

    def add_docs(docs: list[dict[str, Any]]) -> None:
        for doc in docs:
            url = doc.get("url")
            if not url or url in seen_urls:
                continue
            seen_urls.add(url)
            all_docs.append(doc)

    branches: list[tuple[str, str]] = []
    if not inp.get("website_url"):
        branches.append(("website", f'"{company}" website chính thức'))
    if not inp.get("social_urls"):
        branches.append(("fanpage", f'"{company}" facebook fanpage'))
    branches.append(("news", f'"{company}" báo chí'))

    for _branch, query in branches:
        if credits >= limit:
            partial = True
            break
        try:
            docs, cost = _search(query, api_key=api_key)
            credits += cost
            queries.append(query)
            add_docs(docs)
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
            logger.warning("Tavily search failed query=%s: %s", query[:80], exc)
            partial = True

    extract_urls: list[str] = []
    if inp.get("website_url"):
        extract_urls.append(str(inp["website_url"]).strip())
    for doc in all_docs[:5]:
        if doc.get("url"):
            extract_urls.append(str(doc["url"]))
    extract_urls = list(dict.fromkeys(u for u in extract_urls if u))[:5]

    if extract_urls and credits < limit:
        try:
            extracted, cost = _extract(extract_urls, api_key=api_key)
            credits += cost
            add_docs(extracted)
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
            logger.warning("Tavily extract failed: %s", exc)
            partial = True
    elif extract_urls:
        partial = True

    if inp.get("social_urls"):
        for part in str(inp["social_urls"]).split(","):
            url = part.strip()
            if url:
                add_docs(
                    {
                        "title": "Social URL (provided)",
                        "url": url,
                        "content": url,
                        "sourceType": "provided",
                    }
                )

    result = {
        "company_found": len(all_docs) > 0,
        "company_sources": all_docs[:12],
        "credits_used": credits,
        "credits_limit": limit,
        "partial": partial or credits >= limit,
        "researched_at": datetime.now(timezone.utc).isoformat(),
        "stub": False,
        "queries": queries,
    }

    if domain and result["company_found"] and not result.get("stub"):
        try:
            repository.upsert_domain_cache(domain, result)
        except Exception as exc:
            logger.debug("domain cache write skipped domain=%s: %s", domain, exc)

    return result
