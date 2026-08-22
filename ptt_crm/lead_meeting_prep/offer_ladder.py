"""Build CB/TC/CS offer ladder from published SPC offers — S-LMP-3."""
from __future__ import annotations

import json
from typing import Any

TIERS: tuple[str, ...] = ("CB", "TC", "CS")
ANCHOR_BY_TIER = {"CB": "entry", "TC": "recommended", "CS": "premium"}


def _price_hint_vnd(pricing_model: Any) -> int | None:
    if not isinstance(pricing_model, dict):
        return None
    for key in ("monthly_vnd", "setup_vnd", "from_vnd", "amount_vnd", "price_vnd"):
        val = pricing_model.get(key)
        if isinstance(val, (int, float)) and val > 0:
            return int(val)
    tiers = pricing_model.get("tiers")
    if isinstance(tiers, dict):
        for val in tiers.values():
            if isinstance(val, (int, float)) and val > 0:
                return int(val)
    return None


def _load_offers_for_dv(dv_code: str) -> dict[str, dict[str, Any]]:
    code = str(dv_code or "").upper()
    if not code:
        return {}
    try:
        from ptt_jobs.db import pg_available, pg_connection

        if not pg_available():
            return {}
        with pg_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT sku_code, dv_code, tier, label_vi, scope_summary_vi, pricing_model
                    FROM spc_offer
                    WHERE dv_code = %s
                      AND status = 'published'
                      AND active = true
                      AND tier IN ('CB', 'TC', 'CS')
                    ORDER BY CASE tier WHEN 'CB' THEN 1 WHEN 'TC' THEN 2 ELSE 3 END
                    """,
                    (code,),
                )
                rows = cur.fetchall()
        out: dict[str, dict[str, Any]] = {}
        for row in rows:
            tier = str(row[2] or "").upper()
            if tier not in TIERS:
                continue
            pricing = row[5]
            if isinstance(pricing, str):
                try:
                    pricing = json.loads(pricing)
                except json.JSONDecodeError:
                    pricing = {}
            out[tier] = {
                "sku_code": str(row[0]),
                "dv_code": str(row[1]),
                "tier": tier,
                "label_vi": str(row[3] or f"{code}-{tier}"),
                "headline_vi": str(row[4] or row[3] or ""),
                "price_hint_vnd": _price_hint_vnd(pricing),
            }
        return out
    except Exception:
        return {}


def _fallback_offer(dv_code: str, tier: str, name_vi: str) -> dict[str, Any]:
    code = str(dv_code or "DV02").upper()
    return {
        "tier": tier,
        "dv_code": code,
        "sku_code": f"{code}-{tier}",
        "label_vi": f"{name_vi} — {tier}",
        "anchor_role": ANCHOR_BY_TIER[tier],
        "headline_vi": f"Gói {tier} cho {name_vi}",
        "price_hint_vnd": None,
        "reason_vi": f"Gói {tier} phù hợp mức đầu tư và phạm vi triển khai.",
    }


def build_offer_ladder(
    recommended_services: list[dict[str, Any]],
    *,
    industry: str | None = None,
) -> list[dict[str, Any]]:
    primary = recommended_services[0] if recommended_services else {}
    dv_code = str(primary.get("dv_code") or "DV02").upper()
    name_vi = str(primary.get("name_vi") or dv_code)
    offers = _load_offers_for_dv(dv_code)

    ladder: list[dict[str, Any]] = []
    for tier in TIERS:
        row = offers.get(tier)
        if row:
            ladder.append(
                {
                    "tier": tier,
                    "dv_code": row["dv_code"],
                    "sku_code": row["sku_code"],
                    "label_vi": row["label_vi"],
                    "anchor_role": ANCHOR_BY_TIER[tier],
                    "headline_vi": row["headline_vi"] or row["label_vi"],
                    "price_hint_vnd": row["price_hint_vnd"],
                    "reason_vi": (
                        f"Gói {tier} — "
                        f"{'khởi động nhanh' if tier == 'CB' else 'cân bằng ROI' if tier == 'TC' else 'scale tối đa'}"
                        f"{f' cho ngành {industry}' if industry else ''}."
                    ),
                }
            )
        else:
            ladder.append(_fallback_offer(dv_code, tier, name_vi))

    return ladder
