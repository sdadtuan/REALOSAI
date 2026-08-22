"""OpenAI embeddings for Market Research RAG re-embed (P13)."""
from __future__ import annotations

import json
import math
import os
import urllib.error
import urllib.request
from typing import Any

OPENAI_EMBED_MODEL = "text-embedding-3-small"
OPENAI_EMBED_DIMS = 256
OPENAI_EMBED_URL = "https://api.openai.com/v1/embeddings"


def _flag_on() -> bool:
    rag = (os.environ.get("RESEARCH_RAG_ENABLED") or "").strip().lower() in {
        "1",
        "true",
        "yes",
        "on",
    }
    embed = (os.environ.get("RESEARCH_RAG_OPENAI_EMBED_ENABLED") or "").strip().lower() in {
        "1",
        "true",
        "yes",
        "on",
    }
    key = (os.environ.get("OPENAI_API_KEY") or os.environ.get("OPENAI_KEY") or "").strip()
    return rag and embed and bool(key)


def _api_key() -> str:
    return (os.environ.get("OPENAI_API_KEY") or os.environ.get("OPENAI_KEY") or "").strip()


def l2_normalize(vec: list[float]) -> list[float]:
    norm = math.sqrt(sum(v * v for v in vec))
    if not math.isfinite(norm) or norm == 0:
        return [0.0 for _ in vec]
    return [v / norm for v in vec]


def fetch_openai_embedding(text: str, *, api_key: str | None = None) -> dict[str, Any]:
    key = (api_key or _api_key()).strip()
    if not key:
        raise RuntimeError("openai_embed_failed")
    body = json.dumps(
        {"model": OPENAI_EMBED_MODEL, "input": text, "dimensions": OPENAI_EMBED_DIMS}
    ).encode("utf-8")
    req = urllib.request.Request(
        OPENAI_EMBED_URL,
        data=body,
        headers={
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as res:
            payload = json.loads(res.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        raise RuntimeError("openai_embed_failed") from exc
    rows = payload.get("data") if isinstance(payload, dict) else None
    if not isinstance(rows, list) or not rows:
        raise RuntimeError("openai_embed_failed")
    raw = rows[0].get("embedding") if isinstance(rows[0], dict) else None
    if not isinstance(raw, list) or not raw:
        raise RuntimeError("openai_embed_failed")
    embedding = l2_normalize([float(v) for v in raw])
    return {
        "embedding": embedding,
        "model": OPENAI_EMBED_MODEL,
        "dims": len(embedding),
    }


def openai_embed_live() -> bool:
    return _flag_on()
