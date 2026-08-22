"""PrepResult validation — S-LMP-1b."""
from __future__ import annotations

from typing import Any


class PrepResultValidationError(ValueError):
    pass


def validate_prep_result(
    result: dict[str, Any],
    *,
    allowed_dv_codes: set[str] | None = None,
    prep_stage: str = "m1_first_strike",
) -> dict[str, Any]:
    if not isinstance(result, dict):
        raise PrepResultValidationError("result must be object")

    contact = result.get("contact_profile")
    if not isinstance(contact, dict):
        raise PrepResultValidationError("contact_profile required")
    if contact.get("found") is not False:
        raise PrepResultValidationError("contact_profile.found must be false")

    company = result.get("company_profile")
    if not isinstance(company, dict) or not str(company.get("summary") or "").strip():
        raise PrepResultValidationError("company_profile.summary required")

    script = result.get("consulting_script")
    if not isinstance(script, dict):
        raise PrepResultValidationError("consulting_script required")
    if not str(script.get("opening") or "").strip():
        raise PrepResultValidationError("consulting_script.opening required")

    services = result.get("recommended_services")
    if not isinstance(services, list) or not (1 <= len(services) <= 3):
        raise PrepResultValidationError("recommended_services must have 1..3 items")

    for idx, svc in enumerate(services, start=1):
        if not isinstance(svc, dict):
            raise PrepResultValidationError("recommended_services item invalid")
        code = str(svc.get("dv_code") or "").upper()
        if allowed_dv_codes and code and code not in allowed_dv_codes:
            raise PrepResultValidationError(f"invalid dv_code {code}")
        if not str(svc.get("name_vi") or "").strip():
            raise PrepResultValidationError("recommended_services.name_vi required")
        if svc.get("priority") != idx:
            svc["priority"] = idx

    meta = result.get("meta")
    if not isinstance(meta, dict):
        raise PrepResultValidationError("meta required")
    if not str(meta.get("prompt_version") or "").strip():
        raise PrepResultValidationError("meta.prompt_version required")
    meta["prep_stage"] = prep_stage

    result["contact_profile"] = {
        "found": False,
        "summary": str(contact.get("summary") or "Không research profile cá nhân liên hệ (policy)."),
        "facts": [],
    }
    if "social_channels" not in result or not isinstance(result["social_channels"], list):
        result["social_channels"] = []

    return result


def validate_close_intelligence(
    sci: dict[str, Any],
    *,
    prep_stage: str = "m1_first_strike",
    allowed_sku_codes: set[str] | None = None,
) -> dict[str, Any]:
    if not isinstance(sci, dict):
        raise PrepResultValidationError("close_intelligence must be object")

    ladder = sci.get("offer_ladder")
    if not isinstance(ladder, list) or len(ladder) != 3:
        raise PrepResultValidationError("offer_ladder must have length 3")

    tiers: set[str] = set()
    recommended_count = 0
    for item in ladder:
        if not isinstance(item, dict):
            raise PrepResultValidationError("offer_ladder item invalid")
        tier = str(item.get("tier") or "").upper()
        if tier not in {"CB", "TC", "CS"}:
            raise PrepResultValidationError(f"invalid offer tier {tier}")
        if tier in tiers:
            raise PrepResultValidationError("offer_ladder tiers must be unique")
        tiers.add(tier)
        sku = str(item.get("sku_code") or "").upper()
        if allowed_sku_codes and sku and sku not in allowed_sku_codes:
            raise PrepResultValidationError(f"invalid sku_code {sku}")
        anchor = str(item.get("anchor_role") or "")
        if anchor == "recommended":
            recommended_count += 1
        if not str(item.get("label_vi") or "").strip():
            raise PrepResultValidationError("offer_ladder.label_vi required")

    if recommended_count != 1:
        raise PrepResultValidationError("offer_ladder must have exactly one recommended tier")

    talk = sci.get("talk_track")
    if not isinstance(talk, dict):
        raise PrepResultValidationError("talk_track required")
    phases = talk.get("phases")
    if not isinstance(phases, list) or len(phases) < 3:
        raise PrepResultValidationError("talk_track.phases must have >= 3 items")

    objections = sci.get("objection_playbook")
    if not isinstance(objections, list) or not (3 <= len(objections) <= 7):
        raise PrepResultValidationError("objection_playbook must have 3..7 items")

    if prep_stage == "m3_pre_close":
        drp = sci.get("deal_room_payload")
        if not isinstance(drp, dict) or not str(drp.get("opening_narrative_vi") or "").strip():
            raise PrepResultValidationError("deal_room_payload required for m3_pre_close")

    score = sci.get("close_readiness_score")
    if score is not None:
        sci["close_readiness_score"] = min(100, max(0, int(score)))

    return sci


def enforce_contact_policy(result: dict[str, Any]) -> dict[str, Any]:
    result["contact_profile"] = {
        "found": False,
        "summary": "Không research profile cá nhân liên hệ (policy).",
        "facts": [],
    }
    return result
