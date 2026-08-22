"""Tests for lead meeting prep input resolver."""
from __future__ import annotations

from ptt_crm.lead_meeting_prep.input_resolver import resolve_input, should_skip_auto


def test_resolve_input_company_from_meta():
    row = {
        "lead_id": 1,
        "full_name": "A",
        "phone": "0900",
        "email": "",
        "meta_json": {"company_name": "Cty ABC"},
        "is_duplicate": False,
    }
    inp, sources, skip = resolve_input(row)
    assert skip is None
    assert inp["company_name"] == "Cty ABC"
    assert sources["company_name"] == "meta_json"


def test_resolve_input_missing_company():
    row = {
        "lead_id": 2,
        "full_name": "A",
        "phone": "0900",
        "email": "",
        "meta_json": {},
        "is_duplicate": False,
    }
    _, _, skip = resolve_input(row)
    assert skip == "missing_company_name"


def test_should_skip_duplicate():
    row = {"is_duplicate": True, "meta_json": {}}
    assert should_skip_auto(row) == "duplicate_lead"
