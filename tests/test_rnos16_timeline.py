"""RNOS-16 — customer timeline tests."""
from __future__ import annotations

import os
import unittest
from unittest.mock import MagicMock, patch

from ptt_crm.timeline_events import (
    build_attribution_from_legacy_item,
    pg_customer_timeline_ready,
    record_lead_ingested_timeline,
)


class Rnos16TimelineTests(unittest.TestCase):
    def test_build_attribution_from_legacy_item_meta(self):
        item = {
            "source": "facebook",
            "campaign_id": "camp-1",
            "meta": {"facebook_leadgen_id": "fb-99", "form_id": "form-1", "page_id": "pg-1"},
        }
        attr = build_attribution_from_legacy_item(item, "meta")
        self.assertEqual(attr["external_lead_id"], "fb-99")
        self.assertEqual(attr["form_id"], "form-1")

    @patch("ptt_crm.timeline_events.pg_customer_timeline_ready", return_value=False)
    def test_record_lead_ingested_skips_when_table_missing(self, _ready):
        self.assertIsNone(
            record_lead_ingested_timeline(lead_id=1, channel="zalo", external_lead_id="z-1")
        )

    @patch("ptt_crm.timeline_events.insert_timeline_event", return_value="evt-uuid")
    @patch("ptt_crm.timeline_events.pg_customer_timeline_ready", return_value=True)
    def test_record_lead_ingested_zalo_source(self, _ready, insert_mock):
        rid = record_lead_ingested_timeline(
            lead_id=7,
            channel="zalo",
            client_id="00000000-0000-4000-8000-000000000001",
            external_lead_id="zalo-lead-1",
        )
        self.assertEqual(rid, "evt-uuid")
        kwargs = insert_mock.call_args.kwargs
        self.assertEqual(kwargs["event_source"], "zalo")
        self.assertEqual(kwargs["external_ref"], "ingest:zalo:zalo-lead-1")


@unittest.skipUnless(
    "rnosaidb" in os.environ.get("DATABASE_URL", ""),
    "requires DATABASE_URL with rnosaidb",
)
class Rnos16TimelineIntegration(unittest.TestCase):
    def test_pg_customer_timeline_ready(self):
        self.assertTrue(pg_customer_timeline_ready())

    def test_insert_timeline_roundtrip(self):
        from ptt_crm.timeline_events import insert_timeline_event

        ref = f"rnos16-py-{os.getpid()}"
        event_id = insert_timeline_event(
            entity_type="lead",
            entity_id="999999",
            event_type="lead.ingested",
            event_source="system",
            title="py probe",
            external_ref=ref,
        )
        self.assertIsNotNone(event_id)
        from ptt_jobs.db import pg_connection

        with pg_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "DELETE FROM customer_timeline_events WHERE external_ref = %s",
                    (ref,),
                )
            conn.commit()


if __name__ == "__main__":
    unittest.main()
