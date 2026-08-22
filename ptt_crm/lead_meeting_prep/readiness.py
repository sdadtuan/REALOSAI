"""Close readiness score — rule-based with breakdown (S-LMP-1 → S-LMP-3)."""
from __future__ import annotations

from typing import Any


def _factor(label_vi: str, points: int, applied: bool) -> dict[str, Any]:
    return {"label_vi": label_vi, "points": points, "applied": applied}


def compute_readiness_score(inp: dict[str, Any], collect: dict[str, Any]) -> int:
    score, _ = compute_with_breakdown(inp, collect, None)
    return score


def compute_with_breakdown(
    inp: dict[str, Any],
    collect: dict[str, Any],
    close_intelligence: dict[str, Any] | None,
) -> tuple[int, list[dict[str, Any]]]:
    factors: list[dict[str, Any]] = []
    score = 35
    factors.append(_factor("Nền lead CRM", 35, True))

    has_contact = bool(inp.get("phone") or inp.get("email"))
    if has_contact:
        score += 15
    factors.append(_factor("Có SĐT hoặc email", 15, has_contact))

    has_company = bool(inp.get("company_name"))
    if has_company:
        score += 20
    factors.append(_factor("Có tên công ty", 20, has_company))

    has_industry = bool(inp.get("industry"))
    if has_industry:
        score += 10
    factors.append(_factor("Có ngành", 10, has_industry))

    has_problem = bool(inp.get("problem"))
    if has_problem:
        score += 10
    factors.append(_factor("Có pain/problem", 10, has_problem))

    collect_ok = bool(collect.get("company_found") and not collect.get("stub"))
    if collect_ok:
        score += 10
    factors.append(_factor("Research công ty (Tavily)", 10, collect_ok))

    verified = collect.get("verify_website_confidence")
    web_pts = 0
    if verified == "verified":
        web_pts = 10
    elif verified == "provided":
        web_pts = 5
    if web_pts:
        score += web_pts
    factors.append(_factor("Website xác minh", web_pts, web_pts > 0))

    if close_intelligence:
        ladder = close_intelligence.get("offer_ladder") or []
        if len(ladder) == 3:
            score += 5
            factors.append(_factor("Offer ladder 3 gói", 5, True))
        talk = close_intelligence.get("talk_track") or {}
        if len(talk.get("phases") or []) >= 3:
            score += 5
            factors.append(_factor("Talk track SPIN/Challenger", 5, True))
        red_flags = close_intelligence.get("red_flags") or []
        blocks = [r for r in red_flags if isinstance(r, dict) and r.get("severity") == "block"]
        if blocks:
            score -= min(20, 10 * len(blocks))
            factors.append(_factor("Red flag block", -min(20, 10 * len(blocks)), True))

    total = min(100, max(0, score))
    return total, factors
