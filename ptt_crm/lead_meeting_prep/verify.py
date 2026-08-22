"""Verify website/fanpage ownership — fetch HTML + entity detection (S-LMP-1b)."""
from __future__ import annotations

import hashlib
import logging
import re
import urllib.error
import urllib.request
from typing import Any
from urllib.parse import urlparse

logger = logging.getLogger(__name__)

USER_AGENT = "Mozilla/5.0 (compatible; PTT-LMP/1.0; +https://pttads.vn)"
MAX_HTML_BYTES = 2 * 1024 * 1024
FETCH_TIMEOUT_SEC = 10.0

Confidence = str  # verified | provided | cross_verified | likely | unverified


def normalize_phone(raw: str | None) -> str:
    if not raw:
        return ""
    digits = re.sub(r"\D", "", str(raw))
    if digits.startswith("84") and len(digits) >= 10:
        digits = "0" + digits[2:]
    if digits.startswith("0") and len(digits) >= 9:
        return digits[-9:]
    return digits[-9:] if len(digits) >= 9 else digits


def normalize_email(raw: str | None) -> str:
    return str(raw or "").strip().lower()


def phones_match(a: str | None, b: str | None) -> bool:
    na, nb = normalize_phone(a), normalize_phone(b)
    return bool(na) and na == nb


def emails_match(a: str | None, b: str | None) -> bool:
    ea, eb = normalize_email(a), normalize_email(b)
    return bool(ea) and ea == eb


def extract_phones_from_text(text: str) -> set[str]:
    found: set[str] = set()
    for match in re.finditer(r"(?:\+?84|0)[\d\s.\-]{8,16}", text):
        norm = normalize_phone(match.group(0))
        if len(norm) >= 9:
            found.add(norm)
    return found


def extract_emails_from_text(text: str) -> set[str]:
    found: set[str] = set()
    for match in re.finditer(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}", text):
        found.add(normalize_email(match.group(0)))
    return found


def _entity_id(url: str) -> str:
    return hashlib.sha1(url.encode("utf-8")).hexdigest()[:12]


def _domain_slug(url: str) -> str:
    try:
        host = urlparse(url).netloc.lower().replace("www.", "")
        return re.sub(r"[^a-z0-9]", "", host.split(".")[0])
    except Exception:
        return ""


def _company_slug(company_name: str) -> str:
    return re.sub(r"[^a-z0-9]", "", str(company_name or "").lower())


def fetch_html(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=FETCH_TIMEOUT_SEC) as resp:
        data = resp.read(MAX_HTML_BYTES + 1)
        if len(data) > MAX_HTML_BYTES:
            data = data[:MAX_HTML_BYTES]
        return data.decode("utf-8", errors="ignore")


def _candidate_urls(collect: dict[str, Any], inp: dict[str, Any]) -> list[str]:
    urls: list[str] = []
    if inp.get("website_url"):
        urls.append(str(inp["website_url"]).strip())
    for doc in collect.get("company_sources") or []:
        if isinstance(doc, dict) and doc.get("url"):
            urls.append(str(doc["url"]).strip())
    return list(dict.fromkeys(u for u in urls if u.startswith("http")))[:5]


def _score_candidate(
    url: str,
    *,
    inp: dict[str, Any],
    provided: bool,
    html: str | None,
) -> dict[str, Any]:
    confidence: Confidence = "unverified"
    note: str | None = None
    matched_phone: str | None = None
    matched_email: str | None = None

    lead_phone = inp.get("phone")
    lead_email = inp.get("email")

    if provided:
        confidence = "provided"
        note = "URL do AM/lead cung cấp"

    text = html or ""
    phones = extract_phones_from_text(text)
    emails = extract_emails_from_text(text)

    if lead_phone:
        for p in phones:
            if phones_match(p, lead_phone):
                matched_phone = p
                confidence = "verified"
                note = "SĐT khớp trên trang"
                break
    if lead_email and confidence != "verified":
        if normalize_email(lead_email) in emails:
            matched_email = normalize_email(lead_email)
            confidence = "verified"
            note = "Email khớp trên trang"

    if confidence == "unverified" and not provided:
        slug = _domain_slug(url)
        company_slug = _company_slug(str(inp.get("company_name") or ""))
        if slug and company_slug and (slug in company_slug or company_slug in slug):
            confidence = "likely"
            note = "Domain gần khớp tên công ty — cần review"

    return {
        "id": _entity_id(url),
        "url": url,
        "label": urlparse(url).netloc or url,
        "phone": matched_phone,
        "email": matched_email,
        "confidence": confidence,
        "note": note,
        "region_hint": None,
    }


def verify_entities(
    collect: dict[str, Any],
    inp: dict[str, Any],
    *,
    selected_entity_id: str | None = None,
) -> dict[str, Any]:
    """
    Verify candidates and optionally require entity choice.

    Returns dict with keys:
      needs_entity_choice, entity_candidates, selected_entity_id,
      website, filtered_collect, auto_selected
    """
    provided_url = str(inp.get("website_url") or "").strip()
    candidates_raw: list[dict[str, Any]] = []

    for url in _candidate_urls(collect, inp):
        provided = bool(provided_url and url.rstrip("/") == provided_url.rstrip("/"))
        html: str | None = None
        if url.startswith("http") and "facebook.com" not in url.lower():
            try:
                html = fetch_html(url)
            except (urllib.error.URLError, TimeoutError, ValueError) as exc:
                logger.debug("fetch_html failed url=%s: %s", url, exc)
        candidates_raw.append(_score_candidate(url, inp=inp, provided=provided, html=html))

    verified = [c for c in candidates_raw if c["confidence"] == "verified"]
    likely = [c for c in candidates_raw if c["confidence"] in {"likely", "provided"}]

    auto_selected: str | None = None
    needs_entity_choice = False

    if selected_entity_id:
        auto_selected = selected_entity_id
    elif len(verified) == 1:
        auto_selected = verified[0]["id"]
    elif len(verified) >= 2:
        phones = {c.get("phone") for c in verified if c.get("phone")}
        if len(phones) > 1:
            needs_entity_choice = True
        else:
            auto_selected = verified[0]["id"]
    elif len(likely) == 1:
        auto_selected = likely[0]["id"]
    elif len(likely) >= 2 and not verified:
        needs_entity_choice = True

    entity_candidates = [
        {
            "id": c["id"],
            "url": c["url"],
            "label": c["label"],
            "phone": c.get("phone"),
            "region_hint": c.get("region_hint"),
            "confidence": c["confidence"],
        }
        for c in candidates_raw
        if c["confidence"] in {"verified", "likely", "provided"}
    ]

    website: dict[str, Any] | None = None
    selected = next((c for c in candidates_raw if c["id"] == auto_selected), None)
    if selected:
        website = {
            "url": selected["url"],
            "confidence": selected["confidence"],
            "note": selected.get("note"),
        }
    elif candidates_raw:
        best = sorted(
            candidates_raw,
            key=lambda c: {"verified": 0, "provided": 1, "likely": 2, "unverified": 3}.get(
                str(c["confidence"]), 9
            ),
        )[0]
        website = {
            "url": best["url"],
            "confidence": best["confidence"],
            "note": best.get("note"),
        }

    filtered = filter_collect_by_entity(collect, auto_selected, candidates_raw)

    return {
        "needs_entity_choice": needs_entity_choice and not selected_entity_id,
        "entity_candidates": entity_candidates,
        "selected_entity_id": auto_selected,
        "website": website,
        "filtered_collect": filtered,
        "auto_selected": bool(auto_selected and not selected_entity_id),
    }


def filter_collect_by_entity(
    collect: dict[str, Any],
    entity_id: str | None,
    candidates: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    if not entity_id:
        return collect
    selected_url = None
    if candidates:
        for c in candidates:
            if c.get("id") == entity_id:
                selected_url = c.get("url")
                break
    if not selected_url:
        return collect

    domain = urlparse(str(selected_url)).netloc.lower()
    kept: list[dict[str, Any]] = []
    for doc in collect.get("company_sources") or []:
        if not isinstance(doc, dict):
            continue
        url = str(doc.get("url") or "")
        doc_domain = urlparse(url).netloc.lower()
        if doc_domain == domain or "facebook.com" in doc_domain:
            kept.append(doc)
    out = dict(collect)
    out["company_sources"] = kept or collect.get("company_sources") or []
    out["selected_entity_id"] = entity_id
    return out
