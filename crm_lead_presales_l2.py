"""Checklist tài liệu L2 trước buổi Consult — theo service slug."""
from __future__ import annotations

from typing import Any

PRESALES_L2_DOCS_CATALOG: dict[str, list[dict[str, str]]] = {
    "dich-vu-aeo": [
        {"key": "urls", "label": "URL website / landing"},
        {"key": "existing_content", "label": "Content hiện có"},
        {"key": "ai_search_tests", "label": "Test query brand trên ChatGPT/Gemini/Perplexity"},
    ],
    "dich-vu-seo-audit": [
        {"key": "gsc_read", "label": "GSC read access"},
        {"key": "ga4", "label": "GA4"},
        {"key": "hosting", "label": "Hosting / server info"},
        {"key": "audit_goals", "label": "Mục tiêu audit"},
    ],
    "dich-vu-seo-local": [
        {"key": "gbp_link", "label": "Link GBP"},
        {"key": "nap_branches", "label": "NAP chi nhánh"},
        {"key": "storefront_photos", "label": "Ảnh cửa hàng"},
        {"key": "review_count", "label": "Review count / snapshot"},
    ],
    "dich-vu-seo-tong-the": [
        {"key": "gsc_read", "label": "GSC read access"},
        {"key": "ga4", "label": "GA4"},
        {"key": "competitors", "label": "2–3 đối thủ"},
        {"key": "seed_keywords", "label": "Danh sách từ khóa seed"},
    ],
    "quang-cao-facebook": [
        {"key": "ads_account_read", "label": "Ads account read"},
        {"key": "pixel", "label": "Pixel / CAPI"},
        {"key": "lp_url", "label": "LP URL"},
        {"key": "spend_history", "label": "Lịch sử spend"},
    ],
    "quang-cao-google": [
        {"key": "account_read", "label": "Account read"},
        {"key": "conversion_tracking", "label": "Conversion tracking"},
        {"key": "lp_url", "label": "LP URL"},
        {"key": "cpc_estimate", "label": "CPC ước tính / benchmark"},
    ],
    "thue-tai-khoan-quang-cao": [
        {"key": "policy_history", "label": "Lịch sử policy"},
        {"key": "product_qc", "label": "Sản phẩm QC / compliance"},
        {"key": "landing_compliance", "label": "Landing compliance"},
    ],
    "dich-vu-quan-tri-website": [
        {"key": "admin_access", "label": "Admin WP/hosting"},
        {"key": "backup_status", "label": "Backup status"},
        {"key": "plugin_list", "label": "Plugin list"},
    ],
    "thiet-ke-website": [
        {"key": "brand_assets", "label": "Brand assets"},
        {"key": "sitemap_draft", "label": "Sitemap draft"},
        {"key": "reference_urls", "label": "Website tham khảo (URLs)"},
    ],
    "thiet-ke-website-tron-goi": [
        {"key": "feature_list", "label": "Feature list"},
        {"key": "payment_crm", "label": "Payment / CRM integrations"},
        {"key": "hosting_domain", "label": "Hosting / domain"},
    ],
    "thiet-ke-landing-page": [
        {"key": "offer", "label": "Offer / chương trình"},
        {"key": "copy_draft", "label": "Copy draft"},
        {"key": "campaign_context", "label": "Campaign đi kèm"},
        {"key": "brand_guideline", "label": "Brand guideline"},
    ],
    "tiep-thi-noi-dung": [
        {"key": "existing_content", "label": "Content hiện có"},
        {"key": "brand_voice", "label": "Brand voice"},
        {"key": "competitor_urls", "label": "Competitor URLs"},
    ],
    "lead-gen": [
        {"key": "meta_lead_export", "label": "Meta lead form export"},
        {"key": "ads_account_read", "label": "Ads account read"},
        {"key": "lp_url", "label": "LP URL"},
        {"key": "crm_screenshot", "label": "CRM screenshot"},
        {"key": "spend_3mo", "label": "Spend 3 tháng"},
    ],
}


def list_presales_l2_catalog(service_slug: str) -> list[dict[str, str]]:
    return list(PRESALES_L2_DOCS_CATALOG.get(str(service_slug or "").strip(), []))


def parse_presales_l2_docs_json(raw: Any) -> dict[str, bool]:
    if not isinstance(raw, dict):
        return {}
    out: dict[str, bool] = {}
    for key, val in raw.items():
        k = str(key or "").strip()
        if not k:
            continue
        out[k] = val is True or val in (1, "1", "true", "True")
    return out


def build_presales_l2_docs_view(service_slug: str, stored_raw: Any) -> dict[str, Any]:
    catalog = list_presales_l2_catalog(service_slug)
    stored = parse_presales_l2_docs_json(stored_raw)
    items = [{**item, "checked": bool(stored.get(item["key"]))} for item in catalog]
    missing = [item["label"] for item in items if not item["checked"]]
    done = sum(1 for item in items if item["checked"])
    total = len(items)
    return {
        "service_slug": str(service_slug or "").strip(),
        "items": items,
        "total": total,
        "done": done,
        "complete": total == 0 or done >= total,
        "missing_labels": missing,
    }


def merge_presales_l2_docs_patch(
    service_slug: str,
    existing_raw: Any,
    patch: dict[str, bool],
) -> dict[str, bool]:
    catalog_keys = {item["key"] for item in list_presales_l2_catalog(service_slug)}
    merged = parse_presales_l2_docs_json(existing_raw)
    for key, val in (patch or {}).items():
        if key not in catalog_keys:
            continue
        merged[key] = bool(val)
    return merged


def validate_presales_l2_docs_complete(service_slug: str, stored_raw: Any) -> tuple[bool, str]:
    view = build_presales_l2_docs_view(service_slug, stored_raw)
    if view["complete"]:
        return True, ""
    missing = view["missing_labels"]
    return False, f"Tick đủ tài liệu L2 trước khi hoàn thành Consult: {', '.join(missing)}"


def assert_presales_l2_docs_complete(service_slug: str, stored_raw: Any) -> None:
    ok, msg = validate_presales_l2_docs_complete(service_slug, stored_raw)
    if not ok:
        raise ValueError(msg)
