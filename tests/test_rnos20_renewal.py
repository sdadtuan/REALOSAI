"""Tests for RNOS-20 renewal scan job."""
from __future__ import annotations

import unittest
from unittest.mock import patch


class TestRnos20Renewal(unittest.TestCase):
    @patch("ptt_crm.ai_score_api_client._internal_key", return_value="")
    def test_renewal_scan_missing_key(self, _key):
        from ptt_crm.ai_score_api_client import renewal_scan_via_api

        out = renewal_scan_via_api()
        self.assertFalse(out["ok"])
        self.assertTrue(out.get("skipped"))

    @patch("urllib.request.urlopen")
    @patch("ptt_crm.ai_score_api_client._internal_key", return_value="test-key")
    def test_renewal_scan_via_api(self, _key, urlopen_mock):
        from ptt_crm.ai_score_api_client import renewal_scan_via_api

        class Resp:
            status = 200

            def read(self):
                return b'{"data":{"created":1}}'

            def __enter__(self):
                return self

            def __exit__(self, *args):
                return False

        urlopen_mock.return_value = Resp()
        out = renewal_scan_via_api(windows=[90, 60, 30], correlation_id="c-rnos20")
        self.assertTrue(out["ok"])

    @patch("ptt_jobs.handlers.renewal_scan.mark_job_done")
    @patch("ptt_jobs.handlers.renewal_scan.process_renewal_scan_payload")
    def test_run_renewal_scan_job_marks_done(self, process_mock, done_mock):
        from ptt_jobs.handlers.renewal_scan import run_renewal_scan_job

        process_mock.return_value = {"ok": True, "response": {}}
        run_renewal_scan_job({"id": "job-1", "payload": {"windows": [90]}, "attempts": 1, "max_attempts": 3})
        done_mock.assert_called_once_with("job-1")


if __name__ == "__main__":
    unittest.main()
