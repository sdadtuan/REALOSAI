export interface PresalesL2DocItem {
  key: string;
  label: string;
}

/** Tài liệu L2 thu trước buổi Consult — theo service slug (13 slug). */
export const PRESALES_L2_DOCS_CATALOG: Record<string, PresalesL2DocItem[]> = {
  'dich-vu-aeo': [
    { key: 'urls', label: 'URL website / landing' },
    { key: 'existing_content', label: 'Content hiện có' },
    { key: 'ai_search_tests', label: 'Test query brand trên ChatGPT/Gemini/Perplexity' },
  ],
  'dich-vu-seo-audit': [
    { key: 'gsc_read', label: 'GSC read access' },
    { key: 'ga4', label: 'GA4' },
    { key: 'hosting', label: 'Hosting / server info' },
    { key: 'audit_goals', label: 'Mục tiêu audit' },
  ],
  'dich-vu-seo-local': [
    { key: 'gbp_link', label: 'Link GBP' },
    { key: 'nap_branches', label: 'NAP chi nhánh' },
    { key: 'storefront_photos', label: 'Ảnh cửa hàng' },
    { key: 'review_count', label: 'Review count / snapshot' },
  ],
  'dich-vu-seo-tong-the': [
    { key: 'gsc_read', label: 'GSC read access' },
    { key: 'ga4', label: 'GA4' },
    { key: 'competitors', label: '2–3 đối thủ' },
    { key: 'seed_keywords', label: 'Danh sách từ khóa seed' },
  ],
  'quang-cao-facebook': [
    { key: 'ads_account_read', label: 'Ads account read' },
    { key: 'pixel', label: 'Pixel / CAPI' },
    { key: 'lp_url', label: 'LP URL' },
    { key: 'spend_history', label: 'Lịch sử spend' },
  ],
  'quang-cao-google': [
    { key: 'account_read', label: 'Account read' },
    { key: 'conversion_tracking', label: 'Conversion tracking' },
    { key: 'lp_url', label: 'LP URL' },
    { key: 'cpc_estimate', label: 'CPC ước tính / benchmark' },
  ],
  'thue-tai-khoan-quang-cao': [
    { key: 'policy_history', label: 'Lịch sử policy' },
    { key: 'product_qc', label: 'Sản phẩm QC / compliance' },
    { key: 'landing_compliance', label: 'Landing compliance' },
  ],
  'dich-vu-quan-tri-website': [
    { key: 'admin_access', label: 'Admin WP/hosting' },
    { key: 'backup_status', label: 'Backup status' },
    { key: 'plugin_list', label: 'Plugin list' },
  ],
  'thiet-ke-website': [
    { key: 'brand_assets', label: 'Brand assets' },
    { key: 'sitemap_draft', label: 'Sitemap draft' },
    { key: 'reference_urls', label: 'Website tham khảo (URLs)' },
  ],
  'thiet-ke-website-tron-goi': [
    { key: 'feature_list', label: 'Feature list' },
    { key: 'payment_crm', label: 'Payment / CRM integrations' },
    { key: 'hosting_domain', label: 'Hosting / domain' },
  ],
  'thiet-ke-landing-page': [
    { key: 'offer', label: 'Offer / chương trình' },
    { key: 'copy_draft', label: 'Copy draft' },
    { key: 'campaign_context', label: 'Campaign đi kèm' },
    { key: 'brand_guideline', label: 'Brand guideline' },
  ],
  'tiep-thi-noi-dung': [
    { key: 'existing_content', label: 'Content hiện có' },
    { key: 'brand_voice', label: 'Brand voice' },
    { key: 'competitor_urls', label: 'Competitor URLs' },
  ],
  'lead-gen': [
    { key: 'meta_lead_export', label: 'Meta lead form export' },
    { key: 'ads_account_read', label: 'Ads account read' },
    { key: 'lp_url', label: 'LP URL' },
    { key: 'crm_screenshot', label: 'CRM screenshot' },
    { key: 'spend_3mo', label: 'Spend 3 tháng' },
  ],
};

export interface PresalesL2DocRow extends PresalesL2DocItem {
  checked: boolean;
}

export interface PresalesL2DocsView {
  service_slug: string;
  items: PresalesL2DocRow[];
  total: number;
  done: number;
  complete: boolean;
  missing_labels: string[];
}

export function listPresalesL2Catalog(serviceSlug: string): PresalesL2DocItem[] {
  const slug = String(serviceSlug ?? '').trim();
  return PRESALES_L2_DOCS_CATALOG[slug] ?? [];
}

export function parsePresalesL2DocsJson(raw: unknown): Record<string, boolean> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, boolean> = {};
  for (const [key, val] of Object.entries(raw as Record<string, unknown>)) {
    const k = String(key).trim();
    if (!k) continue;
    out[k] = val === true || val === 1 || val === '1' || val === 'true';
  }
  return out;
}

export function buildPresalesL2DocsView(
  serviceSlug: string,
  storedRaw: unknown,
): PresalesL2DocsView {
  const catalog = listPresalesL2Catalog(serviceSlug);
  const stored = parsePresalesL2DocsJson(storedRaw);
  const items: PresalesL2DocRow[] = catalog.map((item) => ({
    ...item,
    checked: Boolean(stored[item.key]),
  }));
  const missing = items.filter((item) => !item.checked).map((item) => item.label);
  const done = items.filter((item) => item.checked).length;
  return {
    service_slug: String(serviceSlug ?? '').trim(),
    items,
    total: items.length,
    done,
    complete: items.length === 0 || done >= items.length,
    missing_labels: missing,
  };
}

export function mergePresalesL2DocsPatch(
  serviceSlug: string,
  existingRaw: unknown,
  patch: Record<string, boolean | undefined>,
): Record<string, boolean> {
  const catalogKeys = new Set(listPresalesL2Catalog(serviceSlug).map((item) => item.key));
  const merged = parsePresalesL2DocsJson(existingRaw);
  for (const [key, val] of Object.entries(patch)) {
    if (!catalogKeys.has(key)) continue;
    if (val === undefined) continue;
    merged[key] = Boolean(val);
  }
  return merged;
}

export function validatePresalesL2DocsComplete(
  serviceSlug: string,
  storedRaw: unknown,
): { ok: boolean; missing_labels: string[]; message: string } {
  const view = buildPresalesL2DocsView(serviceSlug, storedRaw);
  if (view.complete) {
    return { ok: true, missing_labels: [], message: '' };
  }
  return {
    ok: false,
    missing_labels: view.missing_labels,
    message: `Tick đủ tài liệu L2 trước khi hoàn thành Consult: ${view.missing_labels.join(', ')}`,
  };
}

export function assertPresalesL2DocsComplete(serviceSlug: string, storedRaw: unknown): void {
  const result = validatePresalesL2DocsComplete(serviceSlug, storedRaw);
  if (!result.ok) {
    throw new Error(result.message);
  }
}
