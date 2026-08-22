#!/usr/bin/env python3
"""Seed pilot sample for local Gate Phase 0 (≥50 leads, ≥70% timeline, ≥80% attribution)."""
from __future__ import annotations

import argparse
import os
import sys
from datetime import datetime, timedelta, timezone

SEED_PREFIX = "rnos-phase0-gate"
BASE_LEAD_ID = 9_000_001


def seed(*, count: int = 50, timeline_pct: float = 0.76) -> dict:
    from ptt_jobs.db import pg_connection

    count = max(50, int(count))
    with_timeline = max(int(count * timeline_pct), int(count * 0.7) + 1)
    now = datetime.now(timezone.utc)

    inserted_leads = 0
    inserted_timeline = 0
    skipped = False

    with pg_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT COUNT(*)::int FROM crm_leads WHERE write_source = 'rnos_phase0_seed'",
            )
            existing = int(cur.fetchone()[0] or 0)
            if existing >= count:
                skipped = True
            else:
                for i in range(count):
                    lead_id = BASE_LEAD_ID + i
                    external = f"{SEED_PREFIX}-lead-{lead_id}"
                    cur.execute(
                        """
                        INSERT INTO crm_leads (
                          sqlite_lead_id, full_name, phone, email, status, source,
                          is_duplicate, meta_json, channel, external_lead_id,
                          received_at, created_at, synced_at, sync_version, write_source
                        ) VALUES (
                          %s, %s, %s, %s, 'new', %s,
                          FALSE, '{}'::jsonb, %s, %s,
                          %s, %s, %s, 1, 'rnos_phase0_seed'
                        )
                        ON CONFLICT (sqlite_lead_id) DO NOTHING
                        RETURNING sqlite_lead_id
                        """,
                        (
                            lead_id,
                            f"Gate Sample {lead_id}",
                            f"090{lead_id % 10_000_000:07d}",
                            f"gate{lead_id}@example.invalid",
                            "meta" if i % 2 == 0 else "zalo",
                            "meta" if i % 2 == 0 else "zalo",
                            external,
                            now - timedelta(hours=i),
                            now - timedelta(hours=i),
                            now,
                        ),
                    )
                    if cur.fetchone():
                        inserted_leads += 1

                    if i < with_timeline:
                        ref = f"{SEED_PREFIX}:ingest:{external}"
                        cur.execute(
                            "SELECT 1 FROM customer_timeline_events WHERE external_ref = %s LIMIT 1",
                            (ref,),
                        )
                        if cur.fetchone():
                            continue
                        cur.execute(
                            """
                            INSERT INTO customer_timeline_events (
                              entity_type, entity_id, event_type, event_source,
                              title, external_ref, occurred_at
                            ) VALUES (
                              'lead', %s, 'lead.ingested', 'system',
                              'Gate Phase 0 seed ingest', %s, %s
                            )
                            RETURNING id::text
                            """,
                            (str(lead_id), ref, now - timedelta(hours=i)),
                        )
                        if cur.fetchone():
                            inserted_timeline += 1
        conn.commit()

    return {
        "ok": True,
        "skipped": skipped,
        "requested": count,
        "inserted_leads": inserted_leads,
        "inserted_timeline": inserted_timeline,
        "target_timeline_pct": round(100 * with_timeline / count, 1),
    }


def cleanup() -> dict:
    from ptt_jobs.db import pg_connection

    with pg_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "DELETE FROM customer_timeline_events WHERE external_ref LIKE %s",
                (f"{SEED_PREFIX}:%",),
            )
            timeline_deleted = cur.rowcount
            cur.execute(
                "DELETE FROM crm_leads WHERE write_source = 'rnos_phase0_seed'",
            )
            leads_deleted = cur.rowcount
        conn.commit()
    return {"ok": True, "leads_deleted": leads_deleted, "timeline_deleted": timeline_deleted}


def main() -> int:
    parser = argparse.ArgumentParser(description="RNOS Phase 0 local pilot sample seed")
    parser.add_argument("--count", type=int, default=50)
    parser.add_argument("--cleanup", action="store_true")
    args = parser.parse_args()

    if not os.environ.get("DATABASE_URL"):
        print("FAIL DATABASE_URL required", file=sys.stderr)
        return 1

    db = os.environ.get("DATABASE_URL", "")
    if "rnosaidb" not in db and os.environ.get("RNOSAI_ALLOW_NON_RNOSAIDB") != "1":
        print("FAIL expected rnosaidb for local seed", file=sys.stderr)
        return 1

    out = cleanup() if args.cleanup else seed(count=args.count)
    print(out)
    return 0 if out.get("ok") else 1


if __name__ == "__main__":
    raise SystemExit(main())
