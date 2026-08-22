export type SpcOfferStatus = 'draft' | 'published' | 'archived';
export type SpcTier = 'CB' | 'TC' | 'CS';

export type SpcPricingModel = Record<string, unknown>;

export type SpcFamilyRow = {
  dv_code: string;
  name_vi: string;
  department: string;
  role_vi: string;
  service_type: string;
  description_vi: string;
  risks_json: unknown[];
  depends_on_dv: unknown[];
  readiness: string;
  sort_order: number;
  active: boolean;
  updated_at: string;
};

export type SpcOfferRow = {
  sku_code: string;
  dv_code: string;
  tier: SpcTier;
  label_vi: string;
  scope_summary_vi: string;
  pricing_model: SpcPricingModel;
  duration_hint_vi: string;
  status: SpcOfferStatus;
  published_version: number;
  draft_pricing_model: SpcPricingModel | null;
  draft_scope_summary_vi: string | null;
  has_pending_draft: boolean;
  sort_order: number;
  active: boolean;
  updated_at: string;
};

export type SpcOfferLineRow = {
  line_code: string;
  sku_code: string;
  label_vi: string;
  description_vi: string;
  unit: string;
  included_by_default: boolean;
  sort_order: number;
  active: boolean;
  component_code?: string | null;
};

export type SpcPortfolioItem = {
  dv_code: string;
  name_vi: string;
  department: string;
  readiness: string;
  service_type: string;
  offer_count: number;
  published_count: number;
  draft_count: number;
};

export type SpcFamilyDetail = SpcFamilyRow & {
  offers: SpcOfferRow[];
  phase_count: number;
  kpi_count: number;
  component_count: number;
};

export type SpcOfferDetail = SpcOfferRow & {
  lines: SpcOfferLineRow[];
};

export type SpcPublishLogRow = {
  id: number;
  entity_type: string;
  entity_key: string;
  action: string;
  from_version: number | null;
  to_version: number | null;
  actor_email: string;
  diff_json: Record<string, unknown>;
  created_at: string;
};

export type SpcPatchOfferBody = {
  label_vi?: string;
  scope_summary_vi?: string;
  pricing_model?: SpcPricingModel;
  duration_hint_vi?: string;
};

export type SpcPublishBody = {
  entity: 'offer' | 'family' | 'component';
  key: string;
};

export type SpcQuoteCatalogOffer = {
  sku_code: string;
  tier: SpcTier;
  label_vi: string;
  scope_summary_vi: string;
  pricing_model: SpcPricingModel;
  lines: Array<{
    line_code: string;
    label_vi: string;
    description_vi: string;
    included_by_default: boolean;
    component_code?: string | null;
  }>;
};

export type SpcQuoteCatalogComponent = {
  component_code: string;
  name_vi: string;
  description_vi: string;
  deliverable_vi: string;
  pricing_model: SpcPricingModel;
  sort_order: number;
};

export type SpcQuoteCatalogFamily = {
  dv_code: string;
  name_vi: string;
  readiness: string;
  depends_on_dv: string[];
  service_slug: string;
  default_sku_code: string;
  components: SpcQuoteCatalogComponent[];
  offers: SpcQuoteCatalogOffer[];
  is_primary?: boolean;
  is_bundle_suggested?: boolean;
};

export type SpcQuoteCatalogResponse = {
  schema_version: string;
  package_tiers: QuotePackageTierLegacy[];
  service_slug?: string;
  primary_dv: string | null;
  primary_sku: string | null;
  primary_name?: string | null;
  suggested_bundle: string[];
  combo_warnings: Array<{ dv_code: string; message_vi: string }>;
  families: SpcQuoteCatalogFamily[];
};

type QuotePackageTierLegacy = 'basic' | 'standard' | 'premium';

export type SpcProcessPhaseRow = {
  phase_code: string;
  dv_code: string;
  sku_code: string | null;
  week_label_vi: string;
  ptt_work_vi: string;
  deliverable_vi: string;
  client_action_vi: string;
  tasks_json: unknown[];
  sort_order: number;
  active: boolean;
  updated_at?: string;
};

export type SpcOfferProcessResponse = {
  sku_code: string;
  dv_code: string;
  phase_count: number;
  phases: SpcProcessPhaseRow[];
};

export type SpcPutProcessPhaseBody = {
  week_label_vi?: string;
  ptt_work_vi?: string;
  deliverable_vi?: string;
  client_action_vi?: string;
  tasks_json?: unknown[];
  sort_order?: number;
  active?: boolean;
};

export type SpcComponentRow = {
  component_code: string;
  dv_code: string;
  name_vi: string;
  description_vi: string;
  deliverable_vi: string;
  pricing_model: SpcPricingModel;
  unit: string;
  sort_order: number;
  active: boolean;
  status?: 'draft' | 'published' | 'archived';
  published_version?: number;
  draft_pricing_model?: SpcPricingModel | null;
  draft_name_vi?: string | null;
  draft_description_vi?: string | null;
  draft_deliverable_vi?: string | null;
  has_pending_draft?: boolean;
  updated_at?: string;
};

export type SpcBundlePriceAuditStatus =
  | 'ok'
  | 'warn_below_floor'
  | 'warn_above_ceiling'
  | 'no_components';

export type SpcBundlePriceAudit = {
  sku_code: string;
  offer_min_vnd: number;
  offer_max_vnd: number;
  components_min_sum_vnd: number;
  components_max_sum_vnd: number;
  delta_min_vnd: number;
  delta_max_vnd: number;
  status: SpcBundlePriceAuditStatus;
  message_vi: string;
  items: Array<{
    component_code: string;
    name_vi: string;
    qty: number;
    min_vnd: number;
    max_vnd: number;
  }>;
};

export type SpcCreateComponentBody = {
  dv_code: string;
  component_code?: string;
  name_vi: string;
  description_vi?: string;
  deliverable_vi?: string;
  pricing_model?: SpcPricingModel;
  unit?: string;
  sort_order?: number;
};

export type SpcPatchComponentBody = {
  name_vi?: string;
  description_vi?: string;
  deliverable_vi?: string;
  pricing_model?: SpcPricingModel;
  unit?: string;
  sort_order?: number;
  active?: boolean;
};

export type SpcBundleItemRow = {
  sku_code: string;
  component_code: string;
  included: boolean;
  qty: number;
  price_override_vnd: number | null;
  sort_order: number;
  name_vi?: string;
  pricing_model?: SpcPricingModel;
};

export type SpcPutOfferBundleBody = {
  items: Array<{
    component_code: string;
    included?: boolean;
    qty?: number;
    price_override_vnd?: number | null;
    sort_order?: number;
  }>;
};

export type SpcFamilyTreeBundleComponent = {
  component_code: string;
  name_vi: string;
  included: boolean;
  qty: number;
  pricing_model: SpcPricingModel;
};

export type SpcFamilyTreeOffer = {
  sku_code: string;
  tier: SpcTier;
  label_vi: string;
  scope_summary_vi: string;
  pricing_model: SpcPricingModel;
  bundle: SpcFamilyTreeBundleComponent[];
};

export type SpcFamilyTreeResponse = {
  dv_code: string;
  name_vi: string;
  source_doc?: string;
  component_count: number;
  components: SpcComponentRow[];
  offers: SpcFamilyTreeOffer[];
};

export type SpcImportDocBundleResult = {
  dv_code: string;
  components: number;
  bundle_items: number;
  skus: string[];
};

export type SpcImportDocBundleResponse = {
  source_doc?: string;
  imported: number;
  results: SpcImportDocBundleResult[];
};
