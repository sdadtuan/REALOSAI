"""Orchestrate strategize + arm into PrepResult.close_intelligence — S-LMP-3."""
from __future__ import annotations

from typing import Any

from ptt_crm.lead_meeting_prep import arm, readiness, schema, strategize


def enrich_close_intelligence(
    result: dict[str, Any],
    inp: dict[str, Any],
    collect: dict[str, Any],
    *,
    prep_stage: str = "m1_first_strike",
    correlation_id: str | None = None,
    allowed_sku_codes: set[str] | None = None,
) -> dict[str, Any]:
    base_score = readiness.compute_readiness_score(inp, collect)
    strat = strategize.run_strategize(
        inp,
        collect,
        prep_stage=prep_stage,
        base_result=result,
        base_score=base_score,
        correlation_id=correlation_id,
    )
    sci = arm.run_arm(
        inp,
        result,
        strat,
        prep_stage=prep_stage,
        correlation_id=correlation_id,
    )
    sci = schema.validate_close_intelligence(sci, prep_stage=prep_stage, allowed_sku_codes=allowed_sku_codes)
    score, breakdown = readiness.compute_with_breakdown(inp, collect, sci)

    sci["close_readiness_score"] = score
    result["close_intelligence"] = sci

    meta = result.get("meta") if isinstance(result.get("meta"), dict) else {}
    meta["close_readiness_score"] = score
    meta["readiness_breakdown"] = breakdown
    meta["prompt_version"] = "lmp-sci-v1"
    result["meta"] = meta

    return {
        "readiness_score": score,
        "readiness_breakdown": breakdown,
        "close_intelligence": sci,
    }
