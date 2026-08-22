"""Unit tests — close intelligence enrich (S-LMP-3)."""
from ptt_crm.lead_meeting_prep import close_intelligence, schema


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


def test_enrich_adds_close_intelligence():
    inp = {
        "lead_id": 1,
        "company_name": "Cty Gate",
        "industry": "BDS",
        "problem": "Can lead",
        "phone": "0901234567",
    }
    collect = {"company_found": True, "company_sources": []}
    result = _base_result()
    out = close_intelligence.enrich_close_intelligence(result, inp, collect, prep_stage="m1_first_strike")
    sci = result.get("close_intelligence")
    assert sci is not None
    assert len(sci["offer_ladder"]) == 3
    assert len(sci["talk_track"]["phases"]) >= 3
    assert 0 <= out["readiness_score"] <= 100
    schema.validate_close_intelligence(sci, prep_stage="m1_first_strike")
