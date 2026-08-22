"""Unit tests — LMP PrepResult schema (S-LMP-1b)."""
import pytest

from ptt_crm.lead_meeting_prep import schema


def _valid_result():
    return {
        "company_profile": {"summary": "Cty ABC", "facts": []},
        "contact_profile": {"found": False, "summary": "policy", "facts": []},
        "recommended_services": [
            {
                "dv_code": "DV02",
                "name_vi": "Meta Ads",
                "department": "MKT",
                "reason": "phù hợp",
                "priority": 1,
            }
        ],
        "consulting_script": {
            "opening": "Xin chào",
            "pain_points": ["pain"],
            "key_questions": ["q1"],
            "objection_handling": [{"objection": "bận", "response": "5 phút"}],
        },
        "meta": {"prompt_version": "lmp-synth-v1", "researched_at": "2026-01-01T00:00:00Z"},
    }


def test_validate_prep_result_ok():
    out = schema.validate_prep_result(_valid_result(), allowed_dv_codes={"DV02"})
    assert out["contact_profile"]["found"] is False


def test_validate_rejects_contact_found():
    bad = _valid_result()
    bad["contact_profile"] = {"found": True, "summary": "x", "facts": []}
    with pytest.raises(schema.PrepResultValidationError):
        schema.validate_prep_result(bad)


def test_validate_rejects_unknown_dv():
    bad = _valid_result()
    with pytest.raises(schema.PrepResultValidationError):
        schema.validate_prep_result(bad, allowed_dv_codes={"DV99"})


def test_validate_rejects_too_many_services():
    bad = _valid_result()
    bad["recommended_services"] = [
        {"dv_code": "DV02", "name_vi": "a", "department": "MKT", "reason": "r", "priority": i}
        for i in range(1, 5)
    ]
    with pytest.raises(schema.PrepResultValidationError):
        schema.validate_prep_result(bad)
