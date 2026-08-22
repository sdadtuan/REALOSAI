"""Lead Meeting Prep job pipeline — S-LMP-3 (collect → verify → synthesize → strategize → arm)."""
from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timezone
from typing import Any

from ptt_crm.lead_meeting_prep import (
    apify_facebook,
    close_intelligence,
    collect,
    input_resolver,
    repository,
    synthesize,
    verify,
)

logger = logging.getLogger(__name__)

COLLECT_REUSE_HOURS = int(os.environ.get("LMP_M2_COLLECT_REUSE_HOURS", "24") or "24")


def _collect_is_fresh(collect_json: dict[str, Any], updated_at: str | None) -> bool:
    if not collect_json:
        return False
    researched = collect_json.get("researched_at") or collect_json.get("collected_at")
    ts = researched or updated_at
    if not ts:
        return False
    try:
        if isinstance(ts, str):
            dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
        else:
            return False
    except ValueError:
        return False
    age_h = (datetime.now(timezone.utc) - dt.astimezone(timezone.utc)).total_seconds() / 3600.0
    return age_h <= COLLECT_REUSE_HOURS


def _tavily_required() -> bool:
    return os.environ.get("LMP_REQUIRE_TAVILY", "0").strip().lower() in {"1", "true", "yes"}


def process_lead_meeting_prep_payload(
    payload: dict[str, Any], *, correlation_id: str | None = None
) -> dict[str, Any]:
    lead_id = int(payload.get("lead_id") or 0)
    if lead_id <= 0:
        return {"ok": False, "error": "invalid_lead_id"}

    if not repository.table_ready():
        return {"ok": False, "error": "crm_lead_meeting_prep_table_missing"}

    prep_stage = str(payload.get("prep_stage") or "m1_first_strike")
    mode = str(payload.get("mode") or "full")
    selected_entity_id = payload.get("selected_entity_id")

    if mode == "learn" or prep_stage == "m4_learn":
        from ptt_crm.lead_meeting_prep import learn

        return learn.process_learn(lead_id, payload=payload)

    repository.ensure_row(lead_id, prep_stage=prep_stage)

    row = repository.get_lead_context(lead_id)
    if not row:
        repository.set_status(lead_id, status="failed", error_message="lead_not_found")
        return {"ok": False, "error": "lead_not_found"}

    skip = input_resolver.should_skip_auto(row)
    inp, sources, input_skip = input_resolver.resolve_input(row)
    snapshot = {"input": inp, "sources_map": sources}

    if skip or input_skip:
        reason = skip or input_skip or "skipped"
        repository.set_status(
            lead_id,
            status="skipped",
            skip_reason=reason,
            input_snapshot=snapshot,
            prep_stage=prep_stage,
        )
        return {"ok": True, "skipped": True, "reason": reason, "lead_id": lead_id}

    repository.set_status(lead_id, status="running", input_snapshot=snapshot, prep_stage=prep_stage)

    try:
        apify_runs = 0
        if mode == "strategize_arm":
            collect_json = repository.get_collect_json(lead_id) or {}
            existing_result = repository.get_result_json(lead_id) or {}
            meta = existing_result.get("meta") if isinstance(existing_result, dict) else {}
            researched_at = meta.get("researched_at") if isinstance(meta, dict) else None
            if not collect_json or not _collect_is_fresh(collect_json, str(researched_at or "")):
                if prep_stage in {"m2_qualify_win", "m3_pre_close"} or not collect_json:
                    collect_json = collect.collect_company(inp)
            verification = {"filtered_collect": collect_json, "website": None}
            if existing_result and isinstance(existing_result, dict):
                synth = _rearm_only(
                    inp,
                    collect_json,
                    existing_result,
                    prep_stage=prep_stage,
                    correlation_id=correlation_id,
                )
                return _finalize_ready(
                    lead_id,
                    inp,
                    collect_json,
                    verification,
                    synth,
                    prep_stage=prep_stage,
                    apify_runs=0,
                )
        elif mode == "resume_entity" and selected_entity_id:
            collect_json = repository.get_collect_json(lead_id) or {}
            if not collect_json:
                collect_json = collect.collect_company(inp)
        elif mode in {"full", "refresh", "resume_entity"}:
            if _tavily_required() and not os.environ.get("TAVILY_API_KEY"):
                raise RuntimeError("TAVILY_API_KEY missing")
            collect_json = collect.collect_company(inp)
        else:
            collect_json = repository.get_collect_json(lead_id) or collect.collect_company(inp)

        social, apify_runs = apify_facebook.enrich_social_channels(inp, collect_json)
        if social:
            collect_json = {**collect_json, "social_channels": social}

        verification = verify.verify_entities(
            collect_json,
            inp,
            selected_entity_id=str(selected_entity_id) if selected_entity_id else None,
        )

        if verification.get("needs_entity_choice"):
            repository.set_status(
                lead_id,
                status="awaiting_entity_choice",
                collect_json=collect_json,
                entity_candidates=verification.get("entity_candidates") or [],
                prep_stage=prep_stage,
            )
            return {
                "ok": True,
                "lead_id": lead_id,
                "status": "awaiting_entity_choice",
            }

        filtered_collect = verification.get("filtered_collect") or collect_json
        if verification.get("website"):
            filtered_collect = {
                **filtered_collect,
                "verify_website_confidence": verification["website"].get("confidence"),
            }

        synth = synthesize.synthesize_prep(
            inp,
            filtered_collect,
            verify_website=verification.get("website"),
            prep_stage=prep_stage,
            correlation_id=correlation_id,
        )

        return _finalize_ready(
            lead_id,
            inp,
            filtered_collect,
            verification,
            synth,
            prep_stage=prep_stage,
            apify_runs=apify_runs,
            selected_entity_id=verification.get("selected_entity_id"),
        )
    except Exception as exc:
        repository.set_status(lead_id, status="failed", error_message=str(exc))
        logger.exception("lead_meeting_prep failed lead_id=%s", lead_id)
        return {"ok": False, "error": str(exc), "lead_id": lead_id}


def _rearm_only(
    inp: dict[str, Any],
    collect_json: dict[str, Any],
    existing_result: dict[str, Any],
    *,
    prep_stage: str,
    correlation_id: str | None,
) -> dict[str, Any]:
    result = json.loads(json.dumps(existing_result))
    enriched = close_intelligence.enrich_close_intelligence(
        result,
        inp,
        collect_json,
        prep_stage=prep_stage,
        correlation_id=correlation_id,
    )
    return {
        "result": result,
        "readiness_score": enriched["readiness_score"],
        "readiness_breakdown": enriched.get("readiness_breakdown"),
        "ai_run_id": None,
        "stub_mode": True,
    }


def _finalize_ready(
    lead_id: int,
    inp: dict[str, Any],
    filtered_collect: dict[str, Any],
    verification: dict[str, Any],
    synth: dict[str, Any],
    *,
    prep_stage: str,
    apify_runs: int = 0,
    selected_entity_id: str | None = None,
) -> dict[str, Any]:
    result = synth.get("result") or {}
    if social := filtered_collect.get("social_channels"):
        result["social_channels"] = social

    repository.set_status(
        lead_id,
        status="ready",
        collect_json=filtered_collect,
        result_json=result,
        tavily_credits=int(filtered_collect.get("credits_used") or 0),
        close_readiness_score=int(synth.get("readiness_score") or 0),
        prep_stage=prep_stage,
        selected_entity_id=selected_entity_id or verification.get("selected_entity_id"),
        ai_agent_run_id=synth.get("ai_run_id"),
        apify_runs=apify_runs,
        error_message=None,
    )

    try:
        from ptt_crm.timeline_events import record_lead_meeting_prep_ready_timeline

        services = result.get("recommended_services") or []
        record_lead_meeting_prep_ready_timeline(
            lead_id=lead_id,
            client_id=str(inp.get("client_id") or "") or None,
            dv_codes=[str(s.get("dv_code") or "") for s in services if isinstance(s, dict)],
            dv_names=[str(s.get("name_vi") or "") for s in services if isinstance(s, dict)],
            prep_version=1,
        )
    except Exception as exc:
        logger.debug("timeline lmp ready skipped lead=%s: %s", lead_id, exc)

    logger.info(
        "lead_meeting_prep ready lead_id=%s readiness=%s stub=%s",
        lead_id,
        synth.get("readiness_score"),
        synth.get("stub_mode"),
    )
    return {
        "ok": True,
        "lead_id": lead_id,
        "status": "ready",
        "close_readiness_score": synth.get("readiness_score"),
        "ai_run_id": synth.get("ai_run_id"),
    }
