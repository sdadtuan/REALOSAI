"""Unit tests — LMP verify (S-LMP-1b)."""
from ptt_crm.lead_meeting_prep import verify


def test_normalize_phone_vn():
    assert verify.normalize_phone("0901234567") == "901234567"
    assert verify.normalize_phone("+84901234567") == "901234567"
    assert verify.phones_match("090-123-4567", "84901234567")


def test_emails_match():
    assert verify.emails_match("Sales@Example.COM", "sales@example.com")


def test_extract_contact_from_html():
    html = "<p>Liên hệ: 0901234567 hoặc info@acme.vn</p>"
    assert "901234567" in verify.extract_phones_from_text(html)
    assert "info@acme.vn" in verify.extract_emails_from_text(html)


def test_verify_auto_select_single_match(monkeypatch):
    collect = {
        "company_sources": [
            {"url": "https://acme.vn", "title": "ACME", "content": "ignored"}
        ]
    }
    inp = {"company_name": "ACME Corp", "phone": "0901234567", "email": ""}

    monkeypatch.setattr(verify, "fetch_html", lambda url: "<p>Hotline 0901234567</p>")
    out = verify.verify_entities(collect, inp)
    assert out["needs_entity_choice"] is False
    assert out["selected_entity_id"]
    assert out["website"]["confidence"] == "verified"


def test_verify_entity_choice_two_likely_candidates(monkeypatch):
    collect = {
        "company_sources": [
            {"url": "https://acmeland-hcm.vn", "title": "ACME HCM", "content": ""},
            {"url": "https://acmeland-hn.vn", "title": "ACME HN", "content": ""},
        ]
    }
    inp = {"company_name": "ACME Land", "phone": "0909999999", "email": ""}

    monkeypatch.setattr(verify, "fetch_html", lambda url: "<p>No contact here</p>")
    out = verify.verify_entities(collect, inp)
    assert out["needs_entity_choice"] is True
    assert len(out["entity_candidates"]) >= 2


def test_filter_collect_by_entity():
    collect = {
        "company_sources": [
            {"url": "https://a.vn/x", "content": "a"},
            {"url": "https://b.vn/y", "content": "b"},
        ]
    }
    candidates = [
        {"id": "ent-a", "url": "https://a.vn/x"},
        {"id": "ent-b", "url": "https://b.vn/y"},
    ]
    filtered = verify.filter_collect_by_entity(collect, "ent-a", candidates)
    assert len(filtered["company_sources"]) == 1
    assert "a.vn" in filtered["company_sources"][0]["url"]
