"""Tests RNOS-21 — manager coach digest API client + worker handler."""

from __future__ import annotations

import unittest
from unittest.mock import patch


class TestRnos21CoachDigest(unittest.TestCase):
    @patch("ptt_crm.ai_score_api_client._internal_key", return_value="")
    def test_coach_digest_missing_key(self, _key):
        from ptt_crm.ai_score_api_client import coach_digest_via_api

        out = coach_digest_via_api()
        self.assertFalse(out.get("ok"))
        self.assertTrue(out.get("skipped"))

    @patch("urllib.request.urlopen")
    @patch("ptt_crm.ai_score_api_client._internal_key", return_value="test-key")
    def test_coach_digest_via_api(self, _key, urlopen_mock):
        from ptt_crm.ai_score_api_client import coach_digest_via_api

        class FakeResp:
            status = 200

            def read(self):
                return b'{"data":{"created":true,"skipped":false}}'

            def __enter__(self):
                return self

            def __exit__(self, *args):
                return False

        urlopen_mock.return_value = FakeResp()
        out = coach_digest_via_api(force=True, correlation_id="c-rnos21")
        self.assertTrue(out.get("ok"))

    @patch("ptt_jobs.handlers.coach_digest.mark_job_done")
    @patch("ptt_jobs.handlers.coach_digest.process_coach_digest_payload")
    def test_run_coach_digest_job_marks_done(self, process_mock, done_mock):
        from ptt_jobs.handlers.coach_digest import run_coach_digest_job

        process_mock.return_value = {"ok": True}
        run_coach_digest_job({"id": "job-1", "payload": {"force": True}, "attempts": 1, "max_attempts": 3})
        done_mock.assert_called_once_with("job-1")


if __name__ == "__main__":
    unittest.main()
