"""Unit tests — offer ladder (S-LMP-3)."""
from ptt_crm.lead_meeting_prep import offer_ladder


def test_build_offer_ladder_three_tiers():
    services = [{"dv_code": "DV02", "name_vi": "Meta Ads", "department": "MKT", "reason": "r", "priority": 1}]
    ladder = offer_ladder.build_offer_ladder(services, industry="BDS")
    assert len(ladder) == 3
    tiers = {x["tier"] for x in ladder}
    assert tiers == {"CB", "TC", "CS"}
    rec = [x for x in ladder if x["anchor_role"] == "recommended"]
    assert len(rec) == 1
    assert rec[0]["tier"] == "TC"
