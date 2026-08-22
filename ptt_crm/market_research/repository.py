"""PostgreSQL persistence for desk Tavily runs and AI sources."""
from __future__ import annotations

import json
import logging
from typing import Any

from ptt_jobs.db import json_dumps, pg_connection

logger = logging.getLogger(__name__)


def _as_list(val: Any) -> list[str]:
    if val is None:
        return []
    if isinstance(val, list):
        return [str(x) for x in val]
    if isinstance(val, str):
        try:
            parsed = json.loads(val)
            if isinstance(parsed, list):
                return [str(x) for x in parsed]
        except json.JSONDecodeError:
            return [val]
    return []


def load_desk_context(project_id: int, question_id: int) -> dict[str, Any] | None:
    with pg_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT q.question_vi, p.geo
                FROM crm_research_questions q
                JOIN crm_research_projects p ON p.id = q.project_id
                WHERE q.id = %s AND q.project_id = %s
                """,
                (question_id, project_id),
            )
            row = cur.fetchone()
            if not row:
                return None
            return {"question_vi": str(row[0] or ""), "geo": _as_list(row[1])}


def load_pulse_context(project_id: int, question_id: int | None = None) -> dict[str, Any] | None:
    with pg_connection() as conn:
        with conn.cursor() as cur:
            if question_id:
                cur.execute(
                    """
                    SELECT p.geo, p.product_type, q.question_vi
                    FROM crm_research_projects p
                    LEFT JOIN crm_research_questions q
                      ON q.id = %s AND q.project_id = p.id
                    WHERE p.id = %s
                    """,
                    (question_id, project_id),
                )
            else:
                cur.execute(
                    """
                    SELECT p.geo, p.product_type, NULL
                    FROM crm_research_projects p
                    WHERE p.id = %s
                    """,
                    (project_id,),
                )
            row = cur.fetchone()
            if not row:
                return None
            return {
                "geo": _as_list(row[0]),
                "product_type": str(row[1] or ""),
                "question_vi": str(row[2] or ""),
            }


def list_competitor_snapshot_pairs(project_id: int) -> list[dict[str, Any]]:
    with pg_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT competitor_id, fact
                FROM crm_research_competitor_snapshots
                WHERE project_id = %s
                ORDER BY competitor_id ASC, id ASC
                """,
                (project_id,),
            )
            rows = cur.fetchall() or []
    by_comp: dict[int, list[Any]] = {}
    for row in rows:
        cid = int(row[0])
        fact = row[1]
        if isinstance(fact, str):
            try:
                fact = json.loads(fact)
            except json.JSONDecodeError:
                fact = {}
        if not isinstance(fact, dict):
            fact = {}
        by_comp.setdefault(cid, []).append(fact)
    pairs: list[dict[str, Any]] = []
    for facts in by_comp.values():
        if len(facts) < 2:
            continue
        pairs.append({"prev": facts[-2], "next": facts[-1]})
    return pairs


def insert_trend_signal(
    *,
    project_id: int,
    topic: str,
    metric: str,
    baseline: float | None,
    current: float | None,
    velocity: float | None,
    lifecycle: str,
) -> dict[str, Any] | None:
    with pg_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO crm_research_trend_signals (
                  project_id, topic, metric, baseline, current, velocity, lifecycle
                ) VALUES (%s, %s, %s, %s, %s, %s, %s)
                RETURNING id, project_id, topic, metric, baseline, current, velocity, lifecycle
                """,
                (project_id, topic, metric, baseline, current, velocity, lifecycle),
            )
            row = cur.fetchone()
        conn.commit()
    if not row:
        return None
    return {
        "id": int(row[0]),
        "project_id": int(row[1]),
        "topic": str(row[2]),
        "metric": str(row[3]),
        "baseline": float(row[4]) if row[4] is not None else None,
        "current": float(row[5]) if row[5] is not None else None,
        "velocity": float(row[6]) if row[6] is not None else None,
        "lifecycle": str(row[7]),
    }


def upsert_ops_alert(
    *,
    lifecycle_id: int,
    dv_code: str,
    alert_type: str,
    severity: str,
    title: str,
    message: str,
    source_key: str,
) -> None:
    with pg_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO ops_alert_log
                  (lifecycle_id, dv_code, alert_type, severity, title, message, source_key)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (source_key) DO NOTHING
                """,
                (
                    int(lifecycle_id),
                    str(dv_code)[:8],
                    str(alert_type)[:40],
                    str(severity)[:20],
                    str(title)[:500],
                    str(message)[:4000],
                    str(source_key)[:160],
                ),
            )
        conn.commit()


def sum_project_tavily_credits(project_id: int, *, exclude_run_id: int | None = None) -> int:
    with pg_connection() as conn:
        with conn.cursor() as cur:
            if exclude_run_id:
                cur.execute(
                    """
                    SELECT COALESCE(SUM(credits_used), 0)::int
                    FROM crm_research_ai_runs
                    WHERE project_id = %s
                      AND job_type IN ('desk_tavily', 'deep_research', 'research_triangulate', 'research_pulse')
                      AND id <> %s
                    """,
                    (project_id, exclude_run_id),
                )
            else:
                cur.execute(
                    """
                    SELECT COALESCE(SUM(credits_used), 0)::int
                    FROM crm_research_ai_runs
                    WHERE project_id = %s
                      AND job_type IN ('desk_tavily', 'deep_research', 'research_triangulate', 'research_pulse')
                    """,
                    (project_id,),
                )
            row = cur.fetchone()
            return int(row[0] if row else 0)


def mark_run_running(run_id: int) -> None:
    with pg_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE crm_research_ai_runs
                SET status = 'running'
                WHERE id = %s AND status IN ('pending', 'running')
                """,
                (run_id,),
            )
        conn.commit()


def fail_run(run_id: int, error: str, *, credits_used: int = 0) -> None:
    with pg_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE crm_research_ai_runs
                SET status = 'failed',
                    error_message = %s,
                    credits_used = %s,
                    finished_at = now()
                WHERE id = %s
                """,
                (str(error)[:2000], int(credits_used or 0), run_id),
            )
        conn.commit()


def set_run_provider(run_id: int, provider: str) -> None:
    with pg_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE crm_research_ai_runs
                SET provider = %s
                WHERE id = %s
                """,
                (str(provider)[:80], run_id),
            )
        conn.commit()


def succeed_run(run_id: int, *, credits_used: int, output: dict[str, Any]) -> None:
    with pg_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE crm_research_ai_runs
                SET status = 'succeeded',
                    error_message = NULL,
                    credits_used = %s,
                    output_json = %s::jsonb,
                    finished_at = now()
                WHERE id = %s
                """,
                (int(credits_used or 0), json_dumps(output), run_id),
            )
        conn.commit()


def insert_ai_sources(
    *,
    project_id: int,
    question_id: int,
    sources: list[dict[str, Any]],
    geo: list[str] | None = None,
) -> list[int]:
    ids: list[int] = []
    geo_text = (geo or [None])[0] if geo else None
    with pg_connection() as conn:
        with conn.cursor() as cur:
            for src in sources:
                title = str(src.get("title") or src.get("url") or "").strip()
                url = str(src.get("url") or "").strip() or None
                if not title:
                    continue
                cur.execute(
                    """
                    INSERT INTO crm_research_sources (
                      project_id, question_id, source_type, title, publisher, url,
                      accessed_at, geo, reliability_tier, ai_generated, keep, triangulated
                    ) VALUES (
                      %s, %s, %s, %s, %s, %s, now(), %s, 'unknown', true, NULL, %s
                    )
                    RETURNING id
                    """,
                    (
                        project_id,
                        question_id,
                        str(src.get("source_type") or "web"),
                        title[:500],
                        (str(src.get("publisher") or "").strip() or None),
                        url,
                        geo_text,
                        bool(src.get("triangulated")),
                    ),
                )
                row = cur.fetchone()
                if row:
                    ids.append(int(row[0]))
        conn.commit()
    return ids


def insert_sparktoro_sources(
    *,
    project_id: int,
    question_id: int,
    sources: list[dict[str, Any]],
    geo: list[str] | None = None,
) -> list[int]:
    ids: list[int] = []
    geo_text = (geo or [None])[0] if geo else None
    with pg_connection() as conn:
        with conn.cursor() as cur:
            for src in sources:
                title = str(src.get("title") or src.get("url") or "").strip()
                url = str(src.get("url") or "").strip() or None
                if not title:
                    continue
                tier = str(src.get("reliability_tier") or "medium").strip()
                if tier not in {"low", "medium"}:
                    continue
                note = str(src.get("limitation_note") or "").strip()
                if not note:
                    continue
                cur.execute(
                    """
                    INSERT INTO crm_research_sources (
                      project_id, question_id, source_type, title, publisher, url,
                      accessed_at, geo, reliability_tier, limitation_note,
                      ai_generated, keep, triangulated
                    ) VALUES (
                      %s, %s, %s, %s, 'SparkToro', %s, now(), %s, %s, %s, true, true, false
                    )
                    RETURNING id
                    """,
                    (
                        project_id,
                        question_id,
                        str(src.get("source_type") or "web"),
                        title[:500],
                        url,
                        geo_text,
                        tier,
                        note,
                    ),
                )
                row = cur.fetchone()
                if row:
                    ids.append(int(row[0]))
        conn.commit()
    return ids


def insert_evidence(
    *,
    project_id: int,
    study_id: int,
    question_id: int | None,
    locator: str,
    excerpt: str,
    created_by: str = "whisper_ingest",
) -> dict[str, Any]:
    from ptt_crm.market_research.pii_guard import evidence_pii_class

    pii_class = evidence_pii_class(excerpt)
    with pg_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO crm_research_evidence (
                  project_id, source_id, study_id, question_id, locator, excerpt,
                  pii_class, created_by
                ) VALUES (
                  %s, NULL, %s, %s, %s, %s, %s, %s
                )
                RETURNING id, excerpt, locator
                """,
                (
                    project_id,
                    study_id,
                    question_id,
                    str(locator)[:200],
                    str(excerpt)[:500],
                    pii_class,
                    created_by,
                ),
            )
            row = cur.fetchone()
        conn.commit()
    if not row:
        raise RuntimeError("insert_evidence failed")
    return {"id": int(row[0]), "excerpt": row[1], "locator": row[2]}


def load_study_for_project(study_id: int, project_id: int) -> dict[str, Any] | None:
    with pg_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, project_id, name, method, instrument_version, weighting_note, n
                FROM crm_research_studies
                WHERE id = %s AND project_id = %s
                """,
                (study_id, project_id),
            )
            row = cur.fetchone()
    if not row:
        return None
    return {
        "id": int(row[0]),
        "project_id": int(row[1]),
        "name": row[2],
        "method": row[3],
        "instrument_version": row[4],
        "weighting_note": row[5],
        "n": row[6],
    }


def insert_qualtrics_codebook_evidence(
    *,
    project_id: int,
    study_id: int,
    study_name: str,
    drafts: list[dict[str, Any]],
) -> dict[str, Any]:
    from ptt_crm.market_research.pii_guard import pii_hint

    for draft in drafts:
        for key in ("locator", "unit", "value_base", "period_note", "geography", "respondent_id"):
            if pii_hint(str(draft.get(key) or "")):
                raise RuntimeError("survey_pii_forbidden")

    evidence_ids: list[int] = []
    with pg_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO crm_research_sources (
                  project_id, source_type, title, publisher, reliability_tier,
                  limitation_note, ai_generated, keep, triangulated
                ) VALUES (
                  %s, 'survey', %s, 'Qualtrics', 'medium', %s, true, true, false
                )
                RETURNING id
                """,
                (project_id, study_name[:500], QUALTRICS_LIMITATION_NOTE),
            )
            source_row = cur.fetchone()
            if not source_row:
                raise RuntimeError("insert_qualtrics_source failed")
            source_id = int(source_row[0])

            for draft in drafts:
                cur.execute(
                    """
                    INSERT INTO crm_research_evidence (
                      project_id, source_id, study_id, locator, value_num, unit,
                      value_base, period_note, geography, pii_class, created_by
                    ) VALUES (
                      %s, %s, %s, %s, %s, %s, %s, %s, %s, 'none', 'qualtrics'
                    )
                    RETURNING id
                    """,
                    (
                        project_id,
                        source_id,
                        study_id,
                        str(draft.get("locator") or "")[:200],
                        draft.get("value_num"),
                        str(draft.get("unit") or "")[:80],
                        str(draft.get("value_base") or "")[:80],
                        str(draft.get("period_note") or "")[:200] or None,
                        str(draft.get("geography") or "")[:80] or None,
                    ),
                )
                ev_row = cur.fetchone()
                if ev_row:
                    evidence_ids.append(int(ev_row[0]))

            respondents = {str(d.get("respondent_id") or "") for d in drafts if d.get("respondent_id")}
            cur.execute(
                """
                UPDATE crm_research_studies SET n = %s, updated_at = now()
                WHERE id = %s AND project_id = %s
                """,
                (len(respondents), study_id, project_id),
            )
        conn.commit()
    return {"source_id": source_id, "evidence_ids": evidence_ids, "n": len(respondents)}


QUALTRICS_LIMITATION_NOTE = (
    "Mẫu convenience Qualtrics — không MOE/95%. Không suy đại diện dân số."
)


def _insight_embed_text(statement: str, observation: str | None) -> str:
    return " ".join(f"{statement or ''} {observation or ''}".split())


def list_reembed_candidates(
    *,
    client_id: str | None,
    allowed_client_ids: list[str] | None,
    target_dims: int,
    target_model: str,
    limit: int,
) -> list[dict[str, Any]]:
    params: list[Any] = [target_dims, target_model]
    where = [
        "i.status IN ('approved_client_facing', 'published')",
        "(e.insight_id IS NULL OR e.embed_dims IS DISTINCT FROM %s OR COALESCE(e.embed_model, '') <> %s)",
    ]
    if client_id:
        params.append(client_id)
        where.append(f"p.client_id = %s")
    if allowed_client_ids is not None:
        params.append(allowed_client_ids)
        where.append("p.client_id = ANY(%s::text[])")
    params.append(max(1, min(int(limit), 200)))
    sql = f"""
        SELECT i.id AS insight_id,
               i.project_id,
               i.status,
               i.statement,
               i.observation,
               p.client_id,
               e.embed_dims,
               e.embed_model
        FROM crm_research_insights i
        JOIN crm_research_projects p ON p.id = i.project_id
        LEFT JOIN crm_research_insight_embeddings e ON e.insight_id = i.id
        WHERE {' AND '.join(where)}
        ORDER BY i.id ASC
        LIMIT %s
    """
    with pg_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, tuple(params))
            rows = cur.fetchall() or []
    out: list[dict[str, Any]] = []
    for row in rows:
        out.append(
            {
                "insight_id": int(row[0]),
                "project_id": int(row[1]),
                "status": str(row[2]),
                "statement": str(row[3] or ""),
                "observation": str(row[4]) if row[4] is not None else None,
                "client_id": str(row[5]) if row[5] is not None else None,
                "embed_dims": int(row[6]) if row[6] is not None else None,
                "embed_model": str(row[7]) if row[7] is not None else None,
            }
        )
    return out


def count_reembed_stale(
    *,
    client_id: str | None,
    allowed_client_ids: list[str] | None,
    target_dims: int,
    target_model: str,
) -> int:
    params: list[Any] = [target_dims, target_model]
    where = [
        "i.status IN ('approved_client_facing', 'published')",
        "(e.insight_id IS NULL OR e.embed_dims IS DISTINCT FROM %s OR COALESCE(e.embed_model, '') <> %s)",
    ]
    if client_id:
        params.append(client_id)
        where.append("p.client_id = %s")
    if allowed_client_ids is not None:
        params.append(allowed_client_ids)
        where.append("p.client_id = ANY(%s::text[])")
    sql = f"""
        SELECT COUNT(*)::int
        FROM crm_research_insights i
        JOIN crm_research_projects p ON p.id = i.project_id
        LEFT JOIN crm_research_insight_embeddings e ON e.insight_id = i.id
        WHERE {' AND '.join(where)}
    """
    with pg_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, tuple(params))
            row = cur.fetchone()
    return int(row[0] if row else 0)


def upsert_insight_embedding(
    *,
    insight_id: int,
    project_id: int,
    embedding: list[float],
    embed_text: str,
    embed_model: str,
    embed_dims: int,
) -> None:
    with pg_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO crm_research_insight_embeddings (
                  insight_id, project_id, embedding, embed_text, embed_model, embed_dims
                ) VALUES (%s, %s, %s::jsonb, %s, %s, %s)
                ON CONFLICT (insight_id) DO UPDATE SET
                  project_id = EXCLUDED.project_id,
                  embedding = EXCLUDED.embedding,
                  embed_text = EXCLUDED.embed_text,
                  embed_model = EXCLUDED.embed_model,
                  embed_dims = EXCLUDED.embed_dims,
                  updated_at = now()
                """,
                (
                    insight_id,
                    project_id,
                    json_dumps(embedding),
                    embed_text,
                    embed_model,
                    embed_dims,
                ),
            )
        conn.commit()

