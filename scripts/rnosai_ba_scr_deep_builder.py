"""Build deep SCR specs from catalog row + UI/API overrides."""
from __future__ import annotations

from rnosai_ba_detail_helpers import scr_detail

MOD = {
    "CRM": "MOD-CRM — CRM Core",
    "SEO": "MOD-SEO — SEO/AEO Enterprise",
    "EM": "MOD-EM — Email Marketing",
    "PORTAL": "MOD-PORTAL — Client Portal",
}


def build_deep_scr(
    row: list,
    *,
    ui: list[list],
    api: str = "",
    pre: str = "",
    post: str = "",
    purpose: str = "",
    module_key: str = "CRM",
    status_note: str = "",
    app: str = "",
) -> dict:
    scr_id, name, module, route, roles, status, linked_ucs, _ver, _owner, _pri, trace, _upd, notes = row
    default_app = "portal-web (portal.pttads.vn)" if str(module) == "Portal" else "ops-web (rs.pttads.vn)"
    return scr_detail(
        str(scr_id),
        str(name),
        route=str(route),
        module=MOD.get(module_key, str(module)),
        purpose=purpose or str(notes or name),
        roles=str(roles),
        linked_ucs=str(linked_ucs),
        pre=pre,
        post=post,
        api=api,
        app=app or default_app,
        trace=str(trace),
        status_note=status_note or f"{status} (deep spec v2.0)",
        notes=str(notes or ""),
        ui=ui,
        rules=[],  # filled by caller
    )


def merge_deep_specs(
    screens: list[list],
    overrides: dict[str, dict],
    rules_fn,
    *,
    prefix: str,
    skip: set[str],
) -> dict[str, dict]:
    by_id = {str(r[0]): r for r in screens}
    out: dict[str, dict] = {}
    for scr_id, ov in overrides.items():
        if scr_id in skip or not scr_id.startswith(prefix):
            continue
        row = by_id.get(scr_id)
        if not row:
            continue
        spec = build_deep_scr(row, **{k: v for k, v in ov.items() if k != "rules"})
        spec["rules"] = ov.get("rules") or rules_fn(scr_id) or ["—"]
        out[scr_id] = spec
    return out
