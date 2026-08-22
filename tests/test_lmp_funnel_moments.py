"""S-LMP-5 — multi-moment funnel (M1→M2→M3) unit tests."""
from ptt_crm.lead_meeting_prep import close_intelligence
from ptt_crm.lead_meeting_prep.pipeline import _collect_is_fresh


def _base_result():
    return {
        "company_profile": {"summary": "Cty ABC external research", "facts": []},
        "contact_profile": {"found": False, "summary": "policy", "facts": []},
        "recommended_services": [
            {"dv_code": "DV02", "name_vi": "Meta", "department": "MKT", "reason": "r", "priority": 1},
            {"dv_code": "DV05", "name_vi": "SEO", "department": "MKT", "reason": "r2", "priority": 2},
        ],
        "consulting_script": {
            "opening": "Xin chào",
            "pain_points": [],
            "key_questions": ["q1"],
            "objection_handling": [],
        },
        "meta": {
            "prompt_version": "lmp-synth-v1",
            "researched_at": "2026-08-13T10:00:00+00:00",
            "sources_count": 4,
        },
    }


def test_m1_m2_m3_close_intelligence_chain():
    inp = {
        "lead_id": 42,
        "company_name": "Cty Funnel",
        "industry": "BDS",
        "problem": "Lead rác",
        "phone": "0901234567",
        "bant_total": 24,
        "intake_decision": "go",
    }
    collect = {"company_found": True, "company_sources": [], "researched_at": "2026-08-13T10:00:00+00:00"}

    result_m1 = _base_result()
    close_intelligence.enrich_close_intelligence(result_m1, inp, collect, prep_stage="m1_first_strike")
    assert result_m1["close_intelligence"]["offer_ladder"]

    result_m2 = _base_result()
    close_intelligence.enrich_close_intelligence(result_m2, inp, collect, prep_stage="m2_qualify_win")
    assert result_m2["close_intelligence"]["close_readiness_score"] >= 0

    result_m3 = _base_result()
    close_intelligence.enrich_close_intelligence(result_m3, inp, collect, prep_stage="m3_pre_close")
    assert result_m3["close_intelligence"]["deal_room_payload"]["opening_narrative_vi"]


def test_pipeline_collect_fresh_helper():
    fresh = _collect_is_fresh(
        {"researched_at": "2026-08-13T10:00:00+00:00"},
        "2026-08-13T10:00:00+00:00",
    )
    assert isinstance(fresh, bool)
