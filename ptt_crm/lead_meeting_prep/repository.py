"""PostgreSQL persistence for crm_lead_meeting_prep."""
from __future__ import annotations

import json
import logging
from typing import Any

from ptt_jobs.db import pg_connection, pg_available

logger = logging.getLogger(__name__)


def table_ready() -> bool:
    if not pg_available():
        return False
    with pg_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT 1 FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = 'crm_lead_meeting_prep'
                """
            )
            return cur.fetchone() is not None


def get_lead_context(lead_id: int) -> dict[str, Any] | None:
    with pg_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT l.sqlite_lead_id AS lead_id,
                       l.full_name, l.phone, l.email, l.status, l.source, l.channel,
                       l.agency_client_id::text AS client_id,
                       l.is_duplicate,
                       COALESCE(l.meta_json, '{}'::jsonb) AS meta_json
                FROM crm_leads l
                WHERE l.sqlite_lead_id = %s
                """,
                (lead_id,),
            )
            row = cur.fetchone()
            if not row:
                return None
            cols = [d[0] for d in cur.description]
            out = dict(zip(cols, row))
            if isinstance(out.get("meta_json"), str):
                out["meta_json"] = json.loads(out["meta_json"])
            return out


def get_collect_json(lead_id: int) -> dict[str, Any] | None:
    with pg_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT collect_json FROM crm_lead_meeting_prep WHERE lead_id = %s",
                (lead_id,),
            )
            row = cur.fetchone()
            if not row or row[0] is None:
                return None
            val = row[0]
            if isinstance(val, str):
                return json.loads(val)
            return dict(val)


def get_result_json(lead_id: int) -> dict[str, Any] | None:
    with pg_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT result_json FROM crm_lead_meeting_prep WHERE lead_id = %s",
                (lead_id,),
            )
            row = cur.fetchone()
            if not row or row[0] is None:
                return None
            val = row[0]
            if isinstance(val, str):
                return json.loads(val)
            return dict(val)


def get_prep_row(lead_id: int) -> dict[str, Any] | None:
    with pg_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT lead_id, status, prep_stage, win_outcome_json, result_json, collect_json
                FROM crm_lead_meeting_prep WHERE lead_id = %s
                """,
                (lead_id,),
            )
            row = cur.fetchone()
            if not row:
                return None
            cols = [d[0] for d in cur.description]
            out = dict(zip(cols, row))
            for key in ("win_outcome_json", "result_json", "collect_json"):
                val = out.get(key)
                if isinstance(val, str):
                    try:
                        out[key] = json.loads(val)
                    except json.JSONDecodeError:
                        out[key] = {}
            return out


def update_win_outcome_json(lead_id: int, win_outcome: dict[str, Any]) -> None:
    with pg_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO crm_lead_meeting_prep (lead_id, status, prep_stage, win_outcome_json)
                VALUES (%s, 'ready', 'm4_learn', %s::jsonb)
                ON CONFLICT (lead_id) DO UPDATE SET
                  win_outcome_json = EXCLUDED.win_outcome_json,
                  prep_stage = 'm4_learn',
                  updated_at = NOW()
                """,
                (lead_id, json.dumps(win_outcome)),
            )
        conn.commit()


def domain_cache_table_ready() -> bool:
    if not pg_available():
        return False
    with pg_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT 1 FROM information_schema.tables
                WHERE table_schema = 'public'
                  AND table_name = 'crm_lead_meeting_prep_domain_cache'
                """
            )
            return cur.fetchone() is not None


def get_domain_cache(domain: str) -> dict[str, Any] | None:
    if not domain_cache_table_ready():
        return None
    with pg_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT collect_json FROM crm_lead_meeting_prep_domain_cache
                WHERE domain = %s AND expires_at > NOW()
                """,
                [domain.lower().strip()],
            )
            row = cur.fetchone()
            if not row or row[0] is None:
                return None
            val = row[0]
            if isinstance(val, str):
                return json.loads(val)
            return dict(val)


def upsert_domain_cache(domain: str, collect_json: dict[str, Any], *, ttl_days: int = 7) -> None:
    if not domain_cache_table_ready():
        return
    dom = domain.lower().strip()
    if not dom:
        return
    with pg_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO crm_lead_meeting_prep_domain_cache (domain, collect_json, expires_at)
                VALUES (%s, %s::jsonb, NOW() + (%s::int * INTERVAL '1 day'))
                ON CONFLICT (domain) DO UPDATE SET
                  collect_json = EXCLUDED.collect_json,
                  expires_at = EXCLUDED.expires_at
                """,
                (dom, json.dumps(collect_json), max(1, ttl_days)),
            )
        conn.commit()


def set_status(
    lead_id: int,
    *,
    status: str,
    skip_reason: str | None = None,
    error_message: str | None = None,
    collect_json: dict[str, Any] | None = None,
    entity_candidates: list[Any] | None = None,
    result_json: dict[str, Any] | None = None,
    input_snapshot: dict[str, Any] | None = None,
    tavily_credits: int | None = None,
    close_readiness_score: int | None = None,
    prep_stage: str | None = None,
    selected_entity_id: str | None = None,
    ai_agent_run_id: str | None = None,
    apify_runs: int | None = None,
) -> None:
    sets = ["status = %s", "updated_at = NOW()"]
    params: list[Any] = [status]

    if skip_reason is not None:
        sets.append("skip_reason = %s")
        params.append(skip_reason)
    if error_message is not None:
        sets.append("error_message = %s")
        params.append(error_message)
    if collect_json is not None:
        sets.append("collect_json = %s::jsonb")
        params.append(json.dumps(collect_json))
    if entity_candidates is not None:
        sets.append("entity_candidates_json = %s::jsonb")
        params.append(json.dumps(entity_candidates))
    if result_json is not None:
        sets.append("result_json = %s::jsonb")
        params.append(json.dumps(result_json))
    if input_snapshot is not None:
        sets.append("input_snapshot_json = %s::jsonb")
        params.append(json.dumps(input_snapshot))
    if tavily_credits is not None:
        sets.append("tavily_credits_used = %s")
        params.append(tavily_credits)
    if close_readiness_score is not None:
        sets.append("close_readiness_score = %s")
        params.append(close_readiness_score)
    if prep_stage is not None:
        sets.append("prep_stage = %s")
        params.append(prep_stage)
    if selected_entity_id is not None:
        sets.append("selected_entity_id = %s")
        params.append(selected_entity_id)
    if ai_agent_run_id is not None:
        sets.append("ai_agent_run_id = %s::uuid")
        params.append(ai_agent_run_id)
    if apify_runs is not None:
        sets.append("apify_runs = %s")
        params.append(apify_runs)

    params.append(lead_id)
    sql = f"UPDATE crm_lead_meeting_prep SET {', '.join(sets)} WHERE lead_id = %s"

    with pg_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, params)
        conn.commit()


def ensure_row(lead_id: int, prep_stage: str = "m1_first_strike") -> None:
    with pg_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO crm_lead_meeting_prep (lead_id, status, prep_stage)
                VALUES (%s, 'pending', %s)
                ON CONFLICT (lead_id) DO NOTHING
                """,
                (lead_id, prep_stage),
            )
        conn.commit()
