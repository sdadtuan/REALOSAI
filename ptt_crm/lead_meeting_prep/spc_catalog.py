"""Load published SPC DV families for LMP recommendations."""
from __future__ import annotations

from typing import Any


def load_published_dv(limit: int = 21) -> list[dict[str, str]]:
    try:
        from ptt_jobs.db import pg_available, pg_connection

        if not pg_available():
            return _fallback_dv()
        with pg_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT dv_code, name_vi, department
                    FROM spc_family
                    WHERE active = true
                      AND readiness IN ('published', 'ga')
                    ORDER BY sort_order
                    LIMIT %s
                    """,
                    (limit,),
                )
                rows = cur.fetchall()
                if not rows:
                    return _fallback_dv()
                return [
                    {
                        "dv_code": str(r[0]),
                        "name_vi": str(r[1] or ""),
                        "department": str(r[2] or ""),
                    }
                    for r in rows
                ]
    except Exception:
        return _fallback_dv()


def dv_code_set(catalog: list[dict[str, Any]] | None = None) -> set[str]:
    rows = catalog if catalog is not None else load_published_dv()
    return {str(r.get("dv_code") or "").upper() for r in rows if r.get("dv_code")}


def _fallback_dv() -> list[dict[str, str]]:
    return [
        {"dv_code": "DV02", "name_vi": "Quảng cáo Meta", "department": "MKT"},
        {"dv_code": "DV05", "name_vi": "SEO Website", "department": "MKT"},
        {"dv_code": "DV04", "name_vi": "Content Marketing", "department": "MKT"},
    ]
