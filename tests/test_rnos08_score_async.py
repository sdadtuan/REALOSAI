"""RNOS-08 — async lead score queue + consumer tests."""
from __future__ import annotations

import json
import os
import unittest
from unittest.mock import MagicMock, patch


class Rnos08ScoreAsyncTests(unittest.TestCase):
    def test_score_lead_idempotency_key(self):
        from ptt_crm.ai_score_enqueue import score_lead_idempotency_key

        self.assertEqual(score_lead_idempotency_key(42), "score_lead:lead:42")

    @patch.dict(os.environ, {"PTT_AI_SCORE_ASYNC": "0"}, clear=False)
    def test_enqueue_skipped_when_async_disabled(self):
        from ptt_crm.ai_score_enqueue import enqueue_score_lead_job

        self.assertIsNone(enqueue_score_lead_job(lead_id=1))

    @patch("ptt_crm.ai_score_enqueue.score_lead_async_enabled", return_value=True)
    @patch("ptt_jobs.store.enqueue_job_record")
    def test_enqueue_score_lead_job(self, enqueue_mock, _enabled):
        from ptt_crm.ai_score_enqueue import enqueue_score_lead_job

        enqueue_mock.return_value = {"id": "j1", "created": True}
        out = enqueue_score_lead_job(
            lead_id=7,
            client_id="00000000-0000-4000-8000-000000000001",
            correlation_id="corr-1",
        )
        self.assertEqual(out["id"], "j1")
        enqueue_mock.assert_called_once()
        kwargs = enqueue_mock.call_args.kwargs
        self.assertEqual(kwargs["job_type"], "score_lead")
        self.assertEqual(kwargs["payload"]["lead_id"], 7)
        self.assertEqual(kwargs["max_attempts"], 3)

    @patch("ptt_crm.ai_score_api_client._internal_key", return_value="")
    def test_score_api_skips_without_key(self, _key):
        from ptt_crm.ai_score_api_client import score_lead_via_api

        out = score_lead_via_api(lead_id=1)
        self.assertFalse(out["ok"])
        self.assertTrue(out.get("skipped"))

    @patch("ptt_crm.ai_score_api_client.urllib.request.urlopen")
    @patch("ptt_crm.ai_score_api_client._internal_key", return_value="secret")
    def test_score_api_success(self, _key, urlopen_mock):
        from ptt_crm.ai_score_api_client import score_lead_via_api

        resp = MagicMock()
        resp.status = 200
        resp.read.return_value = json.dumps({"data": {"score": 80}}).encode()
        resp.__enter__ = MagicMock(return_value=resp)
        resp.__exit__ = MagicMock(return_value=False)
        urlopen_mock.return_value = resp

        out = score_lead_via_api(lead_id=5, correlation_id="c1")
        self.assertTrue(out["ok"])
        self.assertEqual(out["body"]["data"]["score"], 80)

    @patch("ptt_jobs.handlers.score_lead.mark_job_done")
    @patch("ptt_jobs.handlers.score_lead.process_score_lead_payload")
    def test_run_score_lead_job_marks_done(self, process_mock, done_mock):
        from ptt_jobs.handlers.score_lead import run_score_lead_job

        process_mock.return_value = {"ok": True}
        run_score_lead_job({"id": "job-1", "payload": {"lead_id": 3}, "attempts": 1, "max_attempts": 3})
        done_mock.assert_called_once_with("job-1")

    @patch("ptt_crm.lead_created_score_subscriber.fetch_recent_lead_created_events")
    @patch("ptt_crm.ai_score_enqueue.enqueue_score_lead_job")
    @patch("ptt_crm.ai_score_enqueue.score_lead_async_enabled", return_value=True)
    def test_score_outbox_subscriber(self, _enabled, enqueue_mock, fetch_mock):
        from ptt_crm.lead_created_score_subscriber import process_lead_created_score_outbox

        fetch_mock.return_value = [
            {"id": "ev-1", "payload": {"lead_id": 10, "client_id": "00000000-0000-4000-8000-000000000001"}}
        ]
        enqueue_mock.return_value = {"id": "j1"}
        out = process_lead_created_score_outbox(batch_size=5)
        self.assertEqual(out["enqueued"], 1)
        enqueue_mock.assert_called_once()


if __name__ == "__main__":
    unittest.main()
