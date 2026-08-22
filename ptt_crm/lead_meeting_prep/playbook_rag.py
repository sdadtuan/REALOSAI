"""Industry playbook RAG for LMP strategize — S-LMP-4."""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]

PLAYBOOK_SEARCH_DIRS = (
    ROOT / "services" / "ptt-crm-api" / "src" / "marketing-ai-planner" / "playbooks",
    ROOT / "docs" / "playbooks" / "mkt-ai",
)


def _playbook_dirs() -> list[Path]:
    return [d for d in PLAYBOOK_SEARCH_DIRS if d.is_dir()]


def _load_playbook(path: Path) -> dict[str, Any] | None:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    return data if isinstance(data, dict) else None


def list_playbooks() -> list[dict[str, Any]]:
    seen: set[str] = set()
    out: list[dict[str, Any]] = []
    for directory in _playbook_dirs():
        for path in sorted(directory.glob("*.json")):
            slug = path.stem
            if slug in seen:
                continue
            doc = _load_playbook(path)
            if not doc:
                continue
            seen.add(slug)
            out.append(doc)
    return out


def _norm(text: str) -> str:
    return str(text or "").strip().lower()


def _industry_matches(playbook: dict[str, Any], industry: str) -> bool:
    if not industry:
        return False
    ind = _norm(industry)
    defaults = playbook.get("brief_defaults")
    if isinstance(defaults, dict):
        pb_ind = _norm(str(defaults.get("industry") or ""))
        if pb_ind and (pb_ind in ind or ind in pb_ind):
            return True
    label = _norm(str(playbook.get("label_vi") or ""))
    slug = _norm(str(playbook.get("slug") or ""))
    if "bds" in slug or "bất động sản" in label:
        return "bds" in ind or "bất động sản" in ind or "real estate" in ind
    if "seo" in slug:
        return "seo" in ind
    if "meta" in slug or "lead-gen" in slug:
        return "meta" in ind or "facebook" in ind or "lead" in ind
    return False


def match_playbook(
    *,
    industry: str | None = None,
    service_slug: str | None = None,
) -> dict[str, Any] | None:
    catalog = list_playbooks()
    if not catalog:
        return None

    slug = _norm(service_slug or "")
    if slug:
        for doc in catalog:
            service_slugs = doc.get("service_slugs")
            if isinstance(service_slugs, list) and slug in [_norm(str(s)) for s in service_slugs]:
                return doc
        for doc in catalog:
            if _norm(str(doc.get("slug") or "")) == slug:
                return doc

    if industry:
        for doc in catalog:
            if _industry_matches(doc, industry):
                return doc
    return None


def inject_playbook_into_strategize(
    strategized: dict[str, Any],
    *,
    industry: str | None = None,
    service_slug: str | None = None,
) -> dict[str, Any]:
    doc = match_playbook(industry=industry, service_slug=service_slug)
    if not doc:
        return strategized

    competitive = strategized.get("competitive_angle")
    if not isinstance(competitive, dict):
        competitive = {}
        strategized["competitive_angle"] = competitive

    hints = doc.get("strategy_prompt_hints")
    hint_lines = [str(h).strip() for h in hints if str(h).strip()] if isinstance(hints, list) else []
    if hint_lines:
        proof = competitive.get("ptt_proof")
        proof_list = [str(p).strip() for p in proof if str(p).strip()] if isinstance(proof, list) else []
        merged = proof_list + [f"Playbook: {h}" for h in hint_lines[:3]]
        competitive["ptt_proof"] = merged[:6]

    competitive["playbook_slug"] = str(doc.get("slug") or "")
    competitive["playbook_label_vi"] = str(doc.get("label_vi") or doc.get("slug") or "")
    return strategized
