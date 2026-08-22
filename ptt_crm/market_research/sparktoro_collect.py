"""SparkToro audience collect — source candidates only (P5 M3 / P9 live HTTP). Never create insights."""
from __future__ import annotations

import json
import logging
import os
import urllib.error
import urllib.parse
import urllib.request
from typing import Any, Callable

from ptt_crm.market_research import repository
from ptt_crm.market_research.desk_collect import build_desk_query
from ptt_crm.market_research.pii_guard import pii_hint

logger = logging.getLogger(__name__)

SPARKTORO_LIMITATION_NOTE = (
    "Ước lượng audience SparkToro — không phải census. Không suy “người Việt nghĩ rằng…”."
)
MAX_SNIPPET = 500
SPARKTORO_DEFAULT_BASE = "https://api.sparktoro.com"
SPARKTORO_WEBSITE_LIMIT = 10
SPARKTORO_CREATE_TIMEOUT_SEC = 45.0
SPARKTORO_GET_TIMEOUT_SEC = 20.0


def _flag_on() -> bool:
    return (os.environ.get("RESEARCH_SPARKTORO_ENABLED") or "").strip().lower() in {
        "1",
        "true",
        "yes",
        "on",
    }


def _api_key() -> str:
    return (os.environ.get("SPARKTORO_API_KEY") or "").strip()


def _base_url() -> str:
    return (os.environ.get("SPARKTORO_API_BASE_URL") or SPARKTORO_DEFAULT_BASE).rstrip("/")


def _website_limit() -> int:
    try:
        return max(1, min(int(os.environ.get("SPARKTORO_WEBSITE_LIMIT") or SPARKTORO_WEBSITE_LIMIT), 50))
    except ValueError:
        return SPARKTORO_WEBSITE_LIMIT


def resolve_sparktoro_location(geo: list[str] | None) -> str:
    from_env = (os.environ.get("SPARKTORO_LOCATION") or "us").strip().lower()
    tokens = [str(g or "").strip().upper() for g in (geo or []) if str(g or "").strip()]
    if any(t in {"UK", "GB"} for t in tokens):
        return "uk"
    if any(t in {"CA", "CANADA"} for t in tokens):
        return "ca"
    if from_env in {"uk", "ca", "us"}:
        return from_env
    return "us"


def normalize_sparktoro_websites(raw: Any, limit: int | None = None) -> dict[str, Any]:
    cap = limit if limit is not None else _website_limit()
    cap = max(1, min(cap, 50))
    obj = raw if isinstance(raw, dict) else {}
    meta = obj.get("meta") if isinstance(obj.get("meta"), dict) else {}
    rows = obj.get("data") if isinstance(obj.get("data"), list) else []
    results: list[dict[str, str]] = []
    for row in rows[:cap]:
        if not isinstance(row, dict):
            continue
        domain = str(row.get("domain") or "").strip().lower()
        if not domain:
            continue
        affinity = row.get("affinity")
        category = str(row.get("category") or "").strip()
        meta_desc = str(row.get("meta_description") or "").strip()
        if meta_desc:
            snippet = meta_desc[:MAX_SNIPPET]
        else:
            parts: list[str] = []
            try:
                aff = float(affinity)
                if aff == aff:  # not NaN
                    parts.append(f"Affinity {int(round(aff))}%")
            except (TypeError, ValueError):
                pass
            if category:
                parts.append(category)
            snippet = " · ".join(parts)[:MAX_SNIPPET]
        url = domain if domain.startswith("http") else f"https://{domain}"
        results.append({"url": url, "title": domain[:500], "snippet": snippet})
    credits = 0
    if isinstance(meta, dict):
        try:
            credits = int(meta.get("credits_charged") or 0)
        except (TypeError, ValueError):
            credits = 0
    return {"results": results, "credits_charged": credits}


def map_sparktoro_response(raw: Any) -> list[dict[str, Any]]:
    obj = raw if isinstance(raw, dict) else {}
    rows = obj.get("results") or []
    out: list[dict[str, Any]] = []
    if not isinstance(rows, list):
        return out
    for row in rows:
        if not isinstance(row, dict):
            continue
        url = str(row.get("url") or "").strip()
        title = str(row.get("title") or "").strip()
        snippet = str(row.get("snippet") or "").strip()[:MAX_SNIPPET]
        if not url or not title:
            continue
        if snippet and pii_hint(snippet):
            continue
        out.append(
            {
                "url": url,
                "title": title[:500],
                "publisher": "SparkToro",
                "reliability_tier": "medium",
                "limitation_note": SPARKTORO_LIMITATION_NOTE,
                "snippet": snippet,
                "source_type": "web",
                "ai_generated": True,
                "keep": True,
            }
        )
    return out


def _request_json(
    *,
    method: str,
    url: str,
    api_key: str,
    body: dict[str, Any] | None = None,
    timeout_sec: float,
) -> dict[str, Any]:
    headers = {"Authorization": f"Bearer {api_key}"}
    data = None
    if body is not None:
        headers["Content-Type"] = "application/json"
        data = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=timeout_sec) as resp:
        raw = resp.read().decode("utf-8")
        return json.loads(raw) if raw else {}


def _create_report(query: str, api_key: str, location: str) -> dict[str, Any]:
    url = f"{_base_url()}/v3/describe/create"
    return _request_json(
        method="POST",
        url=url,
        api_key=api_key,
        body={"prompt": query, "location": location},
        timeout_sec=SPARKTORO_CREATE_TIMEOUT_SEC,
    )


def _get_websites(report_id: str, api_key: str, limit: int) -> dict[str, Any]:
    qs = urllib.parse.urlencode({"report_id": report_id, "limit": limit})
    url = f"{_base_url()}/v3/websites?{qs}"
    return _request_json(
        method="GET",
        url=url,
        api_key=api_key,
        body=None,
        timeout_sec=SPARKTORO_GET_TIMEOUT_SEC,
    )


def _fetch_sparktoro(query: str, api_key: str, geo: list[str] | None = None) -> dict[str, Any]:
    location = resolve_sparktoro_location(geo)
    limit = _website_limit()
    try:
        created = _create_report(query, api_key, location)
    except urllib.error.HTTPError as exc:
        raise RuntimeError(f"sparktoro_create_http_{exc.code}") from exc
    except urllib.error.URLError as exc:
        raise RuntimeError("sparktoro_create_failed") from exc
    report_id = str(created.get("report_id") or "").strip()
    if not report_id:
        raise RuntimeError("sparktoro_missing_report_id")
    try:
        websites = _get_websites(report_id, api_key, limit)
    except urllib.error.HTTPError as exc:
        raise RuntimeError(f"sparktoro_websites_http_{exc.code}") from exc
    except urllib.error.URLError as exc:
        raise RuntimeError("sparktoro_websites_failed") from exc
    normalized = normalize_sparktoro_websites(websites, limit)
    return {
        "results": normalized["results"],
        "credits_used": 10 + int(normalized.get("credits_charged") or 0),
        "report_id": report_id,
        "location": location,
    }


def collect_sparktoro(
    *,
    question_vi: str,
    geo: list[str] | None = None,
    fetch: Callable[[str, str, list[str] | None], dict[str, Any]] | None = None,
) -> dict[str, Any]:
    query = build_desk_query(question_vi, geo)
    empty: dict[str, Any] = {"ok": True, "sources": [], "query": query}
    if not _flag_on() or not _api_key():
        return {**empty, "error": "sparktoro_disabled"}
    getter = fetch or _fetch_sparktoro
    try:
        raw = getter(query, _api_key(), geo)
    except RuntimeError as exc:
        return {**empty, "ok": False, "error": str(exc)}
    sources = map_sparktoro_response(raw)
    return {
        **empty,
        "sources": sources,
        "credits_used": int(raw.get("credits_used") or 0),
        "report_id": raw.get("report_id"),
        "location": raw.get("location"),
    }


def process_research_sparktoro_payload(payload: dict[str, Any]) -> dict[str, Any]:
    project_id = int(payload.get("project_id") or 0)
    question_id = int(payload.get("question_id") or 0)
    run_id = int(payload.get("run_id") or 0)
    empty = {"ok": False, "source_ids": []}
    if project_id <= 0 or question_id <= 0 or run_id <= 0:
        return {**empty, "error": "invalid_payload"}

    ctx = repository.load_desk_context(project_id, question_id)
    if not ctx:
        repository.fail_run(run_id, "not_found")
        return {**empty, "error": "not_found"}

    repository.mark_run_running(run_id)
    result = collect_sparktoro(
        question_vi=str(ctx.get("question_vi") or ""),
        geo=list(ctx.get("geo") or []),
    )
    if result.get("error") == "sparktoro_disabled":
        repository.fail_run(run_id, "sparktoro_disabled")
        return {**result, "source_ids": [], "ok": True, "skipped": True}

    if result.get("ok") is False:
        repository.fail_run(run_id, str(result.get("error") or "sparktoro_failed"))
        return {**result, "source_ids": []}

    source_ids = repository.insert_sparktoro_sources(
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
            "report_id": result.get("report_id"),
            "credits_used": result.get("credits_used"),
            "location": result.get("location"),
        },
    )
    return {**result, "source_ids": source_ids, "ok": True}
