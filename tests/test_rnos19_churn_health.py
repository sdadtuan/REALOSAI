"""Tests RNOS-19 — churn health score API client + worker handler."""

from __future__ import annotations

import unittest
from unittest.mock import patch


class TestRnos19ChurnHealth(unittest.TestCase):
    @patch("ptt_crm.ai_score_api_client._internal_key", return_value="")
    def test_churn_score_missing_key(self, _key):
        from ptt_crm.ai_score_api_client import churn_score_via_api

        out = churn_score_via_api()
        self.assertFalse(out.get("ok"))
        self.assertTrue(out.get("skipped"))

    @patch("urllib.request.urlopen")
    @patch("ptt_crm.ai_score_api_client._internal_key", return_value="test-key")
    def test_churn_score_via_api(self, _key, urlopen_mock):
        from ptt_crm.ai_score_api_client import churn_score_via_api

        class FakeResp:
            status = 200

            def read(self):
                return b'{"data":{"scored":2,"skipped":0,"scanned":2}}'

            def __enter__(self):
                return self

            def __exit__(self, *args):
                return False

        urlopen_mock.return_value = FakeResp()
        out = churn_score_via_api(force=True, correlation_id="c-rnos19")
        self.assertTrue(out.get("ok"))

    @patch("ptt_jobs.handlers.churn_health_scan.mark_job_done")
    @patch("ptt_jobs.handlers.churn_health_scan.process_churn_health_scan_payload")
    def test_run_churn_health_scan_job_marks_done(self, process_mock, done_mock):
        from ptt_jobs.handlers.churn_health_scan import run_churn_health_scan_job

        process_mock.return_value = {"ok": True}
        run_churn_health_scan_job({"id": "job-1", "payload": {"force": True}, "attempts": 1, "max_attempts": 3})
        done_mock.assert_called_once_with("job-1")


if __name__ == "__main__":
    unittest.main()
