"""Unit tests — Apify Facebook enrichment (S-LMP-3)."""
from __future__ import annotations

import json
import os
from unittest import mock

from ptt_crm.lead_meeting_prep import apify_facebook


def test_enrich_skipped_without_token():
    with mock.patch.dict(os.environ, {"LMP_APIFY_ENABLED": "1"}, clear=False):
        social, runs = apify_facebook.enrich_social_channels(
            {"social_urls": "https://facebook.com/acme"},
            {},
        )
    assert social == []
    assert runs == 0


def test_enrich_skipped_when_disabled():
    with mock.patch.dict(
        os.environ,
        {"APIFY_API_TOKEN": "tok", "LMP_APIFY_ENABLED": "0"},
        clear=False,
    ):
        social, runs = apify_facebook.enrich_social_channels(
            {"social_urls": "https://facebook.com/acme"},
            {},
        )
    assert social == []
    assert runs == 0


def test_enrich_builds_snapshot_from_apify_responses():
    page_payload = [{"followers": 1200, "categories": ["Spa"]}]
    posts_payload = [{"time": "2026-08-01T10:00:00Z"}, {"time": "2026-07-25T10:00:00Z"}]

    def fake_urlopen(req, timeout=0):
        url = req.full_url
        if "facebook-pages-scraper" in url:
            body = json.dumps(page_payload).encode()
        else:
            body = json.dumps(posts_payload).encode()

        class Resp:
            def read(self):
                return body

            def __enter__(self):
                return self

            def __exit__(self, *args):
                return False

        return Resp()

    env = {
        "APIFY_API_TOKEN": "tok",
        "LMP_APIFY_ENABLED": "1",
        "LMP_APIFY_TIMEOUT_SEC": "60",
    }
    with mock.patch.dict(os.environ, env, clear=False):
        with mock.patch("urllib.request.urlopen", side_effect=fake_urlopen):
            social, runs = apify_facebook.enrich_social_channels(
                {"facebook_page_url": "https://www.facebook.com/acme"},
                {},
            )

    assert runs == 2
    assert len(social) == 1
    assert social[0]["platform"] == "facebook"
    assert social[0]["followers"] == 1200
    assert "bài/tuần" in (social[0].get("posting_frequency") or "")


def test_normalize_fb_url():
    assert apify_facebook._normalize_fb_url("facebook.com/acme") == "https://facebook.com/acme"
    assert apify_facebook._normalize_fb_url("https://example.com") is None
