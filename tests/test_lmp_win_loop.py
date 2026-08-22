"""S-LMP-6 — win loop learn step tests."""
from ptt_crm.lead_meeting_prep import learn


def test_process_learn_skips_without_debrief(monkeypatch):
    monkeypatch.setattr(learn.repository, "table_ready", lambda: True)
    monkeypatch.setattr(learn.repository, "get_prep_row", lambda _id: {"win_outcome_json": {}})
    out = learn.process_learn(42)
    assert out["ok"] is True
    assert out.get("skipped") is True


def test_process_learn_enriches_when_debrief_present(monkeypatch):
    monkeypatch.setattr(learn.repository, "table_ready", lambda: True)
    monkeypatch.setattr(
        learn.repository,
        "get_prep_row",
        lambda _id: {
            "win_outcome_json": {
                "submitted_at": "2026-08-13T12:00:00Z",
                "closed_tier": "TC",
            }
        },
    )
    monkeypatch.setattr(
        learn.repository,
        "get_lead_context",
        lambda _id: {"meta_json": {"industry": "spa"}},
    )
    monkeypatch.setattr(
        learn.repository,
        "get_result_json",
        lambda _id: {"recommended_services": [{"dv_code": "DV02"}]},
    )
    captured = {}

    def _update(lead_id, payload):
        captured["lead_id"] = lead_id
        captured["payload"] = payload

    monkeypatch.setattr(learn.repository, "update_win_outcome_json", _update)
    out = learn.process_learn(7, payload={"terminal_status": "chot"})
    assert out["ok"] is True
    assert captured["payload"]["learn_processed_at"]
    assert captured["payload"]["recommended_dv_codes"] == ["DV02"]
