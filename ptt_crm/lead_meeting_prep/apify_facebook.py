"""Apify Facebook enrichment — graceful fail (S-LMP-3)."""
from __future__ import annotations

import json
import logging
import os
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from typing import Any

logger = logging.getLogger(__name__)

APIFY_BASE = "https://api.apify.com/v2"
PAGE_ACTOR = "apify~facebook-pages-scraper"
POSTS_ACTOR = "apify~facebook-posts-scraper"


def enrich_social_channels(
    inp: dict[str, Any],
    collect: dict[str, Any],
) -> tuple[list[dict[str, Any]], int]:
    """
    Returns (social_channels, apify_runs_count).
    Never raises — prep continues when Apify unavailable.
    """
    token = (os.environ.get("APIFY_API_TOKEN") or os.environ.get("APIFY_TOKEN") or "").strip()
    social_url = _resolve_fb_url(inp, collect)
    if not token or not social_url:
        return [], 0

    if os.environ.get("LMP_APIFY_ENABLED", "0").strip().lower() not in {"1", "true", "yes"}:
        return [], 0

    runs = 0
    try:
        page_items, runs = _run_actor(PAGE_ACTOR, {"startUrls": [{"url": social_url}]}, token, runs)
        posts_items, runs = _run_actor(
            POSTS_ACTOR,
            {"startUrls": [{"url": social_url}], "resultsLimit": 10},
            token,
            runs,
        )
        snapshot = _build_snapshot(social_url, page_items, posts_items)
        if snapshot:
            return [snapshot], runs
        logger.info("lmp apify empty snapshot url=%s", social_url[:80])
        return [], runs
    except Exception as exc:
        logger.warning("lmp apify failed: %s", exc)
        return [], runs


def _resolve_fb_url(inp: dict[str, Any], collect: dict[str, Any]) -> str | None:
    candidates: list[str] = []
    for raw in (
        inp.get("social_urls"),
        inp.get("facebook_page_url"),
        _extract_fb_from_collect(collect),
    ):
        if not raw:
            continue
        if isinstance(raw, list):
            candidates.extend(str(x).strip() for x in raw if str(x).strip())
        else:
            candidates.append(str(raw).strip())
    for url in candidates:
        normalized = _normalize_fb_url(url)
        if normalized:
            return normalized
    return None


def _normalize_fb_url(url: str) -> str | None:
    text = str(url or "").strip()
    if not text or "facebook.com" not in text.lower():
        return None
    if not text.startswith("http"):
        text = f"https://{text.lstrip('/')}"
    parsed = urllib.parse.urlparse(text)
    if "facebook.com" not in (parsed.netloc or "").lower():
        return None
    return text.split("#")[0].rstrip("/")


def _extract_fb_from_collect(collect: dict[str, Any]) -> str | None:
    for doc in collect.get("company_sources") or []:
        if not isinstance(doc, dict):
            continue
        url = str(doc.get("url") or "")
        if "facebook.com" in url.lower():
            return url
    return None


def _timeout_sec() -> float:
    try:
        return max(30.0, min(float(os.environ.get("LMP_APIFY_TIMEOUT_SEC", "120") or 120), 300.0))
    except ValueError:
        return 120.0


def _run_actor(
    actor_id: str,
    actor_input: dict[str, Any],
    token: str,
    runs: int,
) -> tuple[list[dict[str, Any]], int]:
    timeout = int(_timeout_sec())
    encoded_actor = urllib.parse.quote(actor_id, safe="")
    url = (
        f"{APIFY_BASE}/acts/{encoded_actor}/run-sync-get-dataset-items"
        f"?token={urllib.parse.quote(token)}&timeout={timeout}"
    )
    req = urllib.request.Request(
        url,
        data=json.dumps(actor_input).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout + 15) as resp:
            raw = resp.read().decode("utf-8")
            items = json.loads(raw) if raw else []
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")[:200]
        raise RuntimeError(f"Apify HTTP {exc.code}: {body}") from exc

    if not isinstance(items, list):
        return [], runs + 1
    return [x for x in items if isinstance(x, dict)], runs + 1


def _build_snapshot(
    url: str,
    page_items: list[dict[str, Any]],
    posts_items: list[dict[str, Any]],
) -> dict[str, Any] | None:
    page = page_items[0] if page_items else {}
    followers = _first_int(page, ("followers", "likes", "fanCount", "followersCount"))
    category = _first_str(page, ("categories", "category", "pageCategory"))
    ad_status = _first_str(page, ("ad_status", "adStatus", "isRunningAds"))
    posting_frequency = _derive_posting_frequency(posts_items)

    if followers is None and not posting_frequency and not category and not ad_status:
        return None

    note_parts: list[str] = []
    if category:
        note_parts.append(str(category)[:80])
    if posting_frequency:
        note_parts.append(posting_frequency)

    return {
        "platform": "facebook",
        "url": url,
        "followers": followers,
        "posting_frequency": posting_frequency,
        "ad_status": ad_status,
        "note": " · ".join(note_parts) if note_parts else "Apify snapshot",
    }


def _derive_posting_frequency(posts: list[dict[str, Any]]) -> str | None:
    if not posts:
        return None
    timestamps: list[datetime] = []
    for post in posts[:10]:
        for key in ("time", "timestamp", "publishedAt", "createdAt", "date"):
            ts = _parse_ts(post.get(key))
            if ts:
                timestamps.append(ts)
                break
    if len(timestamps) < 2:
        return f"{len(posts)} bài gần nhất (Apify)"
    timestamps.sort(reverse=True)
    span_days = max(1.0, (timestamps[0] - timestamps[-1]).total_seconds() / 86_400)
    per_week = round(len(timestamps) / span_days * 7, 1)
    return f"~{per_week} bài/tuần (10 bài Apify)"


def _parse_ts(raw: Any) -> datetime | None:
    if raw is None:
        return None
    if isinstance(raw, (int, float)):
        try:
            return datetime.fromtimestamp(float(raw), tz=timezone.utc)
        except (OSError, ValueError):
            return None
    text = str(raw).strip()
    if not text:
        return None
    if text.isdigit():
        try:
            return datetime.fromtimestamp(int(text), tz=timezone.utc)
        except (OSError, ValueError):
            return None
    try:
        return datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError:
        return None


def _first_int(row: dict[str, Any], keys: tuple[str, ...]) -> int | None:
    for key in keys:
        val = row.get(key)
        if val is None:
            continue
        if isinstance(val, list) and val:
            val = val[0]
        try:
            n = int(str(val).replace(",", "").strip())
            if n >= 0:
                return n
        except ValueError:
            continue
    return None


def _first_str(row: dict[str, Any], keys: tuple[str, ...]) -> str | None:
    for key in keys:
        val = row.get(key)
        if val is None:
            continue
        if isinstance(val, list):
            val = ", ".join(str(x) for x in val[:3] if str(x).strip())
        text = str(val).strip()
        if text:
            return text[:120]
    return None
