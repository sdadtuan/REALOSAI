"""RNOS Gate Phase 0 — DDL + timeline + attribution + audit smoke (local/staging)."""
from __future__ import annotations

import json
import logging
from dataclasses import asdict, dataclass
from typing import Any

logger = logging.getLogger(__name__)

GATE_MIN_TIMELINE_PCT = 70.0
GATE_MIN_ATTRIBUTION_PCT = 80.0
GATE_MIN_SAMPLE_LEADS = 50


@dataclass
class Phase0Check:
    id: str
    ok: bool
    label: str
    detail: dict[str, Any]


def phase0_rnos01_ready() -> Phase0Check:
    from ptt_crm.pg_schema import (
        pg_revenue_os_ai_migration_applied,
        pg_revenue_os_ai_r1_core_ready,
        pg_revenue_os_ai_ready,
        pg_revenue_os_ai_smoke_insert_ok,
    )

    migration = pg_revenue_os_ai_migration_applied()
    r1_core = pg_revenue_os_ai_r1_core_ready()
    full = pg_revenue_os_ai_ready()
    smoke = pg_revenue_os_ai_smoke_insert_ok()
    ok = migration and r1_core and full and smoke
    return Phase0Check(
        id="P0-G01",
        ok=ok,
        label="RNOS-01 DDL + ai_agent_runs smoke insert",
        detail={
            "migration_applied": migration,
            "r1_core_ready": r1_core,
            "full_ready": full,
            "smoke_insert_ok": smoke,
        },
    )


def phase0_timeline_completeness(
    *,
    sample_limit: int = 500,
    min_pct: float = GATE_MIN_TIMELINE_PCT,
    min_sample: int = GATE_MIN_SAMPLE_LEADS,
) -> Phase0Check:
    limit = max(1, min(int(sample_limit), 5000))
    try:
        from ptt_jobs.db import pg_connection

        with pg_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    WITH recent_leads AS (
                      SELECT sqlite_lead_id::text AS lead_id
                      FROM crm_leads
                      WHERE COALESCE(is_duplicate, FALSE) IS NOT TRUE
                      ORDER BY created_at DESC
                      LIMIT %s
                    ),
                    with_timeline AS (
                      SELECT DISTINCT rl.lead_id
                      FROM recent_leads rl
                      INNER JOIN customer_timeline_events t
                        ON t.entity_type = 'lead' AND t.entity_id = rl.lead_id
                    )
                    SELECT
                      (SELECT COUNT(*)::int FROM recent_leads) AS total_leads,
                      (SELECT COUNT(*)::int FROM with_timeline) AS leads_with_timeline
                    """,
                    (limit,),
                )
                row = cur.fetchone()
                total = int(row[0] or 0)
                with_timeline = int(row[1] or 0)
    except Exception as exc:
        logger.debug("phase0_timeline_completeness: %s", exc)
        return Phase0Check(
            id="P0-G02",
            ok=False,
            label=f"Timeline completeness ≥{min_pct}% (sample n≥{min_sample})",
            detail={"error": str(exc)},
        )

    pct = round((1000 * with_timeline) / total, 1) / 10 if total else 0.0
    sample_ok = total >= min_sample
    pct_ok = pct >= min_pct if total else False
    ok = sample_ok and pct_ok
    return Phase0Check(
        id="P0-G02",
        ok=ok,
        label=f"Timeline completeness ≥{min_pct}% (sample n≥{min_sample})",
        detail={
            "total_leads": total,
            "leads_with_timeline": with_timeline,
            "completeness_pct": pct,
            "sample_limit": limit,
            "min_sample": min_sample,
            "min_pct": min_pct,
            "sample_size_ok": sample_ok,
            "pct_ok": pct_ok,
        },
    )


def phase0_attribution_coverage(
    *,
    days: int = 90,
    min_pct: float = GATE_MIN_ATTRIBUTION_PCT,
) -> Phase0Check:
    window = max(1, int(days))
    try:
        from ptt_jobs.db import pg_connection

        with pg_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT
                      COUNT(*)::int AS total,
                      COUNT(*) FILTER (
                        WHERE COALESCE(NULLIF(TRIM(source), ''), '') <> ''
                          AND COALESCE(NULLIF(TRIM(channel), ''), '') <> ''
                      )::int AS attributed
                    FROM crm_leads
                    WHERE created_at >= NOW() - (%s || ' days')::interval
                      AND COALESCE(is_duplicate, FALSE) IS NOT TRUE
                    """,
                    (str(window),),
                )
                total, attributed = cur.fetchone()
                total = int(total or 0)
                attributed = int(attributed or 0)
    except Exception as exc:
        logger.debug("phase0_attribution_coverage: %s", exc)
        return Phase0Check(
            id="P0-G03",
            ok=False,
            label=f"Attribution source+channel ≥{min_pct}% ({window}d)",
            detail={"error": str(exc)},
        )

    pct = round((1000 * attributed) / total, 1) / 10 if total else 0.0
    ok = total > 0 and pct >= min_pct
    return Phase0Check(
        id="P0-G03",
        ok=ok,
        label=f"Attribution source+channel ≥{min_pct}% ({window}d)",
        detail={
            "window_days": window,
            "total_leads": total,
            "attributed_leads": attributed,
            "attribution_pct": pct,
            "min_pct": min_pct,
        },
    )


def phase0_ingest_tables_ready() -> Phase0Check:
    """Smoke: core OLTP tables readable (no regression signal)."""
    try:
        from ptt_jobs.db import pg_connection

        with pg_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT COUNT(*)::int FROM crm_leads")
                leads = int(cur.fetchone()[0] or 0)
                cur.execute("SELECT COUNT(*)::int FROM job_queue")
                jobs = int(cur.fetchone()[0] or 0)
        return Phase0Check(
            id="P0-G04",
            ok=True,
            label="CRM ingest tables readable (crm_leads, job_queue)",
            detail={"crm_leads_count": leads, "job_queue_count": jobs},
        )
    except Exception as exc:
        return Phase0Check(
            id="P0-G04",
            ok=False,
            label="CRM ingest tables readable (crm_leads, job_queue)",
            detail={"error": str(exc)},
        )


def build_phase0_gate_report(
    *,
    sample_limit: int = 500,
    min_timeline_pct: float = GATE_MIN_TIMELINE_PCT,
    min_attribution_pct: float = GATE_MIN_ATTRIBUTION_PCT,
    min_sample: int = GATE_MIN_SAMPLE_LEADS,
) -> dict[str, Any]:
    checks = [
        phase0_rnos01_ready(),
        phase0_timeline_completeness(
            sample_limit=sample_limit,
            min_pct=min_timeline_pct,
            min_sample=min_sample,
        ),
        phase0_attribution_coverage(min_pct=min_attribution_pct),
        phase0_ingest_tables_ready(),
    ]
    ok = all(c.ok for c in checks)
    return {
        "gate": "RNOS-Phase-0",
        "ok": ok,
        "checks": [asdict(c) for c in checks],
        "thresholds": {
            "timeline_completeness_pct": min_timeline_pct,
            "attribution_pct": min_attribution_pct,
            "min_sample_leads": min_sample,
        },
    }


def write_phase0_gate_report(path: str, report: dict[str, Any]) -> None:
    from pathlib import Path

    p = Path(path)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(report, indent=2, default=str) + "\n", encoding="utf-8")
