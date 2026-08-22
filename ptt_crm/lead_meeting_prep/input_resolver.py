"""Resolve LeadMeetingPrepInput from crm_leads row."""
from __future__ import annotations

from typing import Any


def _pick(meta: dict[str, Any], *keys: str) -> str:
    for key in keys:
        val = meta.get(key)
        if val is not None and str(val).strip():
            return str(val).strip()
    return ""


def resolve_input(row: dict[str, Any]) -> tuple[dict[str, Any], dict[str, str], str | None]:
    meta = row.get("meta_json") or {}
    if isinstance(meta, str):
        import json

        try:
            meta = json.loads(meta)
        except json.JSONDecodeError:
            meta = {}

    sources: dict[str, str] = {}
    company = _pick(meta, "company_name", "company")
    if company:
        sources["company_name"] = "meta_json"

    form_data = meta.get("form_data") if isinstance(meta.get("form_data"), dict) else {}

    inp = {
        "lead_id": int(row["lead_id"]),
        "full_name": str(row.get("full_name") or "").strip(),
        "phone": str(row.get("phone") or "").strip(),
        "email": str(row.get("email") or "").strip(),
        "company_name": company,
        "industry": _pick(meta, "industry", "industry_slug"),
        "marketing_budget": _pick(meta, "budget", "marketing_budget") or _pick(form_data, "budget"),
        "problem": _pick(meta, "notes", "need", "problem") or _pick(form_data, "need"),
        "website_url": _pick(meta, "website_url", "domain", "website") or None,
        "social_urls": _pick(meta, "social_urls", "facebook_page_url", "page_url") or None,
        "client_id": row.get("client_id"),
        "channel": row.get("channel"),
        "source": row.get("source"),
    }

    if len(company) < 2:
        return inp, sources, "missing_company_name"
    if not inp["phone"] and not inp["email"]:
        return inp, sources, "missing_contact"
    return inp, sources, None


def should_skip_auto(row: dict[str, Any]) -> str | None:
    if row.get("is_duplicate"):
        return "duplicate_lead"
    meta = row.get("meta_json") or {}
    flow = str(meta.get("lead_flow_kind") or meta.get("lead_flow") or "").strip().lower()
    if flow in {"spa_operational", "spa"}:
        return "spa_operational"
    return None
