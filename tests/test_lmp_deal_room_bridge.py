"""Unit tests — S-LMP-4 Deal Room bridge."""
from ptt_crm.lead_meeting_prep import close_intelligence, playbook_rag, schema


def _base_result():
    return {
        "company_profile": {"summary": "Cty ABC", "facts": []},
        "contact_profile": {"found": False, "summary": "policy", "facts": []},
        "recommended_services": [
            {"dv_code": "DV02", "name_vi": "Meta", "department": "MKT", "reason": "r", "priority": 1}
        ],
        "consulting_script": {
            "opening": "Xin chào",
            "pain_points": [],
            "key_questions": ["q1"],
            "objection_handling": [],
        },
        "meta": {"prompt_version": "lmp-synth-v1", "researched_at": "2026-01-01T00:00:00Z"},
    }


def test_m3_deal_room_payload_required():
    inp = {
        "lead_id": 1,
        "company_name": "Cty Gate",
        "industry": "Bất động sản",
        "problem": "Can lead",
        "phone": "0901234567",
    }
    collect = {"company_found": True, "company_sources": []}
    result = _base_result()
    close_intelligence.enrich_close_intelligence(result, inp, collect, prep_stage="m3_pre_close")
    sci = result["close_intelligence"]
    drp = sci["deal_room_payload"]
    assert drp["opening_narrative_vi"]
    assert len(drp["slide_bullets_vi"]) >= 1
    assert drp["recommended_close_ask_vi"]
    schema.validate_close_intelligence(sci, prep_stage="m3_pre_close")


def test_playbook_rag_matches_bds_industry():
    doc = playbook_rag.match_playbook(industry="Bất động sản")
    if doc is None:
        return
    stub = {"competitive_angle": {"ptt_proof": [], "playbook_slug": None}}
    out = playbook_rag.inject_playbook_into_strategize(stub, industry="Bất động sản")
    assert out["competitive_angle"]["playbook_slug"]
    assert out["competitive_angle"].get("playbook_label_vi")
