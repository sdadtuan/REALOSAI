import { API_BASE, ApiError, parseJson } from './api';

export class ResearchApiError extends ApiError {
  constructor(
    message: string,
    status: number,
    readonly code?: string,
    readonly messages?: string[],
  ) {
    super(message, status);
    this.name = 'ResearchApiError';
  }
}

export const INSIGHT_STATUSES = [
  'draft',
  'evidence_attached',
  'analyst_verified',
  'peer_reviewed',
  'approved_internal',
  'approved_client_facing',
  'published',
  'superseded',
  'expired',
  'rejected',
] as const;
export type InsightStatus = (typeof INSIGHT_STATUSES)[number];

export const INSIGHT_STATUS_LABELS: Record<InsightStatus, string> = {
  draft: 'Nháp',
  evidence_attached: 'Đã gắn evidence',
  analyst_verified: 'Analyst đã verify',
  peer_reviewed: 'Peer review',
  approved_internal: 'Duyệt nội bộ',
  approved_client_facing: 'Duyệt bản khách',
  published: 'Đã phát hành',
  superseded: 'Thay thế',
  expired: 'Hết hạn',
  rejected: 'Từ chối',
};

export function canSubmitInsightReview(status: InsightStatus | null | undefined): boolean {
  return status == null || status === 'draft' || status === 'evidence_attached' || status === 'rejected';
}

export function hasPersistedInsightRubric(
  insight: Pick<ResearchInsight, 'confidence_json'>,
): boolean {
  const raw = insight.confidence_json;
  if (!raw || typeof raw !== 'object') return false;
  if ('band' in raw && (raw as ConfidenceJson).band) return true;
  const nested = 'rubric' in raw && raw.rubric && typeof raw.rubric === 'object' ? raw.rubric : raw;
  const src = nested as Partial<ConfidenceRubric>;
  return RUBRIC_DIMS.every((d) => typeof src[d] === 'number');
}

/** Omit EMPTY_RUBRIC fallback unless the analyst touched it or a stored rubric exists. */
export function insightConfidencePayload(
  rubric: ConfidenceRubric,
  opts: { touched: boolean; hasStoredRubric: boolean },
): ConfidenceRubric | undefined {
  if (opts.touched || opts.hasStoredRubric) return rubric;
  return undefined;
}

export const INSIGHT_GATE_COPY: Record<string, string> = {
  missing_verified_evidence: 'Cần ≥1 evidence đã verify',
  missing_confidence_rationale: 'Thiếu giải thích độ tin cậy',
  missing_confidence_rubric: 'Thiếu rubric 5 chiều (0–4)',
  forbidden_confidence_wording: 'Không ghi 95% confidence trừ khi đây là inference thống kê.',
  cannot_self_approve: 'Người tạo không tự duyệt — nhờ Research Lead.',
};

export const RUBRIC_DIMS = ['S', 'F', 'T', 'A', 'R'] as const;
export type RubricDim = (typeof RUBRIC_DIMS)[number];

export type ConfidenceRubric = {
  S: number;
  F: number;
  T: number;
  A: number;
  R: number;
  statistical_inference?: boolean;
};

export type ConfidenceBand = 'low' | 'medium' | 'high' | 'very_high';

export const CONFIDENCE_BAND_LABELS: Record<ConfidenceBand, string> = {
  low: 'Thấp',
  medium: 'Trung bình',
  high: 'Cao',
  very_high: 'Rất cao',
};

export type ConfidenceJson = {
  rubric: ConfidenceRubric;
  score: number;
  band: ConfidenceBand;
  override_down?: boolean;
};

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

export const PRODUCT_TYPES = [
  'CAT_REVIEW',
  'COMP_LAND',
  'CONSUMER',
  'SEG_STP',
  'BRAND_HEALTH',
  'PRICE_OFFER',
  'CAMPAIGN',
  'TREND_SCAN',
  'GTM',
  'TRACKER',
] as const;
export type ProductType = (typeof PRODUCT_TYPES)[number];

export const PROJECT_STATUSES = [
  'intake',
  'designed',
  'collecting',
  'qc',
  'analyzing',
  'synthesizing',
  'drafting',
  'in_review',
  'approved',
  'distributed',
  'archived',
  'cancelled',
] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const PRODUCT_TYPE_CARDS: Array<{ type: ProductType; label: string; subcopy: string }> = [
  { type: 'CAT_REVIEW', label: 'Category review', subcopy: 'TAM/SAM/SOM, cấu trúc ngành' },
  { type: 'COMP_LAND', label: 'Competitive landscape', subcopy: 'Đối thủ, positioning, SOV proxy' },
  { type: 'CONSUMER', label: 'Consumer / shopper', subcopy: 'JTBD, pain, ngôn ngữ thật' },
  { type: 'SEG_STP', label: 'Segmentation / STP', subcopy: 'Priority segment' },
  { type: 'BRAND_HEALTH', label: 'Brand health', subcopy: 'Funnel, equity' },
  { type: 'PRICE_OFFER', label: 'Pricing / offer', subcopy: 'Giá, gói' },
  { type: 'CAMPAIGN', label: 'Campaign / concept', subcopy: 'Đánh giá ads' },
  { type: 'TREND_SCAN', label: 'Trend scan', subcopy: 'Tín hiệu 6–18 tháng' },
  { type: 'GTM', label: 'Go-to-market', subcopy: 'Kênh + message' },
  { type: 'TRACKER', label: 'Tracker', subcopy: 'Pulse lặp' },
];

export const STATUS_LABELS: Record<ProjectStatus, string> = {
  intake: 'Tiếp nhận',
  designed: 'Thiết kế',
  collecting: 'Thu thập',
  qc: 'QC',
  analyzing: 'Phân tích',
  synthesizing: 'Tổng hợp',
  drafting: 'Soạn báo cáo',
  in_review: 'Đang duyệt',
  approved: 'Đã duyệt',
  distributed: 'Đã giao',
  archived: 'Lưu trữ',
  cancelled: 'Huỷ',
};

export const TRANSITION_REASON_VI: Record<string, string> = {
  need_rq: 'Cần ≥1 câu hỏi nghiên cứu',
  cannot_revert_approved: 'Không thể hoàn trạng thái đã duyệt',
  need_verified_insight: 'Cần ≥1 insight đã verify',
  evidence_immutable: 'Evidence đã khóa (verified / superseded / rejected) — không sửa được',
  evidence_duplicate_checksum: 'Checksum trùng evidence đã verify trong project',
  job_in_flight: 'Job đang chạy cho câu hỏi này',
  tavily_unconfigured: 'Chưa cấu hình Tavily — job failed, project không đổi.',
  tavily_credit_cap: 'Hết credit Tavily của dự án',
  jobs_disabled: 'Hàng đợi job đang tắt — thử lại sau.',
  deep_research_disabled: 'Deep Research đang tắt.',
  llm_unconfigured: 'Chưa cấu hình Claude (ANTHROPIC_API_KEY).',
  llm_provider_error: 'Claude không trả lời được — thử lại sau.',
  llm_timeout: 'Claude hết thời gian chờ.',
  methodology_incomplete: 'Gói TC/CS bắt buộc phụ lục phương pháp trước khi xuất.',
  client_mismatch: 'Insight không thuộc khách hàng đã chọn.',
  insight_not_approved: 'Chỉ được chèn insight đã duyệt nội bộ trở lên.',
  forbidden: 'Không đủ quyền với khách hàng này.',
  cannot_self_approve: 'Người tạo không tự duyệt — nhờ Research Lead.',
  exec_en_locked: 'Bản dịch EN đã duyệt — tạo phiên bản mới để sửa (BR-RES-05).',
  insights_not_client_facing: 'Chỉ công bố khi insight đã duyệt bản khách. Không tự đăng.',
  waves_not_tracker: 'Waves chỉ dùng cho dự án TRACKER.',
  wave_no_duplicate: 'Số wave đã tồn tại trên dự án này.',
  decision_locked: 'Không sửa nội dung decision — tạo dòng mới (BR-RES-05).',
  consent_required: 'Cần consent còn hạn trước khi tải audio.',
  consent_expired: 'Consent đã hết hạn — không tải audio được.',
  whisper_disabled: 'Whisper đang tắt — project không đổi.',
  raw_transcript_forbidden: 'Chỉ lưu đoạn trích ≤ 500 ký tự. Không lưu transcript đầy đủ.',
  sparktoro_disabled: 'SparkToro đang tắt — không tạo insight.',
  talkwalker_disabled: 'Talkwalker đang tắt — không tạo insight.',
  qualtrics_disabled: 'Qualtrics đang tắt — không tạo insight.',
  qualtrics_failed: 'Export Qualtrics thất bại — thử lại hoặc kiểm tra map/SV ID.',
  qualtrics_map_required: 'Thiếu column map — gửi body hoặc ghi qualtrics_column_map vào weighting_note.',
  qualtrics_survey_id_required: 'Study cần instrument_version dạng SV_…',
  survey_pii_forbidden: 'CSV codebook không được chứa SĐT hoặc email.',
  codebook_csv_invalid: 'CSV codebook không hợp lệ.',
  codebook_row_cap: 'CSV codebook vượt quá 500 dòng.',
  vw_not_price_offer: 'Van Westendorp chỉ dùng cho dự án PRICE_OFFER.',
  cj_not_price_offer: 'Conjoint lite chỉ dùng cho dự án PRICE_OFFER.',
  cj_insufficient_n: 'Cần ≥4 người trả lời hợp lệ.',
  cj_insufficient_choices: 'Cần ≥4 lựa chọn hợp lệ.',
  cj_too_many_attributes: 'Conjoint lite tối đa 3 thuộc tính.',
  cj_too_few_attributes: 'Conjoint lite cần ít nhất 2 thuộc tính.',
  cj_whatif_empty: 'Chọn ít nhất một mức thuộc tính.',
  cj_whatif_unknown_attribute: 'Thuộc tính không có trong mẫu conjoint.',
  cj_whatif_no_choices: 'Chưa có lựa chọn conjoint để đếm khớp.',
  vw_insufficient_n: 'Cần ≥4 người trả lời hợp lệ để tính Van Westendorp.',
  rag_disabled: 'Tìm insight đã duyệt đang tắt.',
  rag_query_required: 'Nhập câu hỏi để tìm insight đã duyệt.',
  taxonomy_code_exists: 'Mã theme đã tồn tại.',
};

export type MethodologyBlock = {
  population: string;
  source_plan: string;
  limitation: string;
  stub?: boolean;
};

export const METHODOLOGY_EXPORT_BANNER =
  'Gói TC/CS bắt buộc phụ lục phương pháp trước khi xuất.';

export function isMethodologyComplete(
  m: Pick<MethodologyBlock, 'population' | 'source_plan' | 'limitation'>,
): boolean {
  return [m.population, m.source_plan, m.limitation].every(
    (f) => String(f ?? '').trim().length >= 8,
  );
}

export function isMethodologyExportable(
  tier: 'CB' | 'TC' | 'CS',
  m: MethodologyBlock | undefined | null,
): boolean {
  if (tier === 'CB' && m?.stub === true) return true;
  if (!m) return tier === 'CB';
  return isMethodologyComplete(m);
}

export type ReportExec = {
  vi: string;
  en: string | null;
  en_status: 'none' | 'draft' | 'approved';
};

export function normalizeReportExec(raw: unknown): ReportExec {
  if (typeof raw === 'string') {
    return { vi: raw, en: null, en_status: 'none' };
  }
  const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const vi = String(obj.vi ?? obj.exec ?? '').trim();
  const en = obj.en == null ? null : String(obj.en).trim() || null;
  const st = obj.en_status;
  const en_status = st === 'draft' || st === 'approved' || st === 'none' ? st : en ? 'draft' : 'none';
  return { vi, en, en_status };
}

export type ResearchReportSnapshot = {
  cover?: {
    client?: string;
    title?: string;
    confidential?: boolean;
    version?: number;
    as_of?: string;
  };
  exec?: ReportExec | string;
  findings?: unknown[];
  recs?: unknown[];
  methodology?: MethodologyBlock;
  evidence_index?: Array<{ ev_id: number; locator: string; insight_id: number }>;
  status?: string;
};

export type ResearchQuestion = {
  id: number;
  project_id: number;
  sort_order: number;
  question_vi: string;
  question_en: string | null;
  analysis_frame: string | null;
  created_at: string;
};

export type ResearchProject = {
  id: number;
  client_id: string;
  client_name: string | null;
  lifecycle_id?: number | null;
  title: string;
  product_type: ProductType;
  dv12_tier: 'CB' | 'TC' | 'CS';
  decision_statement: string;
  geo: string[];
  languages: string[];
  risk_class: 'low' | 'medium' | 'high';
  status: ProjectStatus;
  owner_user_id: number | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  rq_count: number;
  verified_insight_count: number;
  questions?: ResearchQuestion[];
  sources?: ResearchSource[];
  evidence?: ResearchEvidence[];
  insights?: ResearchInsight[];
  ai_runs?: ResearchAiRun[];
  tavily_credits_used?: number;
  tavily_credits_limit?: number;
  deep_research_provider?: string;
  valid_transitions?: ProjectStatus[];
  trend_signals?: ResearchTrendSignal[];
};

export type ResearchTrendSignal = {
  id: number;
  project_id: number;
  topic: string;
  metric: string;
  baseline: number | null;
  current: number | null;
  velocity: number | null;
  lifecycle: 'new' | 'rising' | 'stable' | 'fading';
};

export type IsoGapStatus = 'pass' | 'partial' | 'fail' | 'na';

export type IsoGapPhase = 'planning' | 'execution' | 'supervision' | 'reporting';

export type IsoGapItem = {
  id: string;
  phase: IsoGapPhase;
  label_vi: string;
  status: IsoGapStatus;
  hint_vi?: string;
};

export type IsoGapSummary = {
  pass: number;
  partial: number;
  fail: number;
  na: number;
};

export type IsoGapCheckPayload = {
  ok: true;
  project_id: number;
  product_type: string;
  items: IsoGapItem[];
  summary: IsoGapSummary;
};

export type ResearchAiRun = {
  id: number;
  project_id: number;
  question_id: number | null;
  job_type: string;
  provider: string;
  model: string | null;
  status: string;
  credits_used: number;
  error_message: string | null;
  actor: string | null;
  created_at: string;
  finished_at: string | null;
};

export type ResearchInsight = {
  id: number;
  project_id: number;
  statement: string;
  observation: string | null;
  interpretation: string | null;
  implication: string | null;
  recommendation: string | null;
  audience: string | null;
  status: InsightStatus;
  confidence_rationale: string | null;
  confidence_json?: ConfidenceJson | ConfidenceRubric | null;
  ai_generated: boolean;
  created_by: string | null;
  valid_from: string | null;
  valid_to: string | null;
  is_stale?: boolean;
  created_at: string;
  updated_at: string;
  evidence_ids: number[];
};

export type CreateInsightBody = {
  statement: string;
  observation?: string | null;
  interpretation?: string | null;
  implication?: string | null;
  recommendation?: string | null;
  audience?: string | null;
  confidence_rationale?: string | null;
  confidence_json?: ConfidenceRubric;
  valid_from?: string | null;
  valid_to?: string | null;
};

export const COMPETITOR_FACT_KEYS = [
  'price',
  'share_claim',
  'channel',
  'message',
  'promo',
  'geo',
  'period',
] as const;

export type CompetitorFactKey = (typeof COMPETITOR_FACT_KEYS)[number];
export type CompetitorFact = Partial<Record<CompetitorFactKey, string | number | null>>;

export const COMPETITOR_FACT_LABELS: Record<CompetitorFactKey, string> = {
  price: 'Giá',
  share_claim: 'Share',
  channel: 'Kênh',
  message: 'Message',
  promo: 'Promo',
  geo: 'Địa bàn',
  period: 'Kỳ',
};

export type ResearchCompetitorSnapshot = {
  id: number;
  competitor_id: number;
  project_id: number;
  source_id: number;
  observed_at: string;
  kind: 'fact' | 'hypothesis';
  fact: CompetitorFact;
  limitation_note: string | null;
  created_by: string | null;
  created_at: string;
};

export type ResearchCompetitor = {
  id: number;
  project_id: number;
  name: string;
  aliases: string[];
  created_by: string | null;
  created_at: string;
  updated_at: string;
  snapshots: ResearchCompetitorSnapshot[];
};

export type CreateCompetitorBody = {
  name: string;
  aliases?: string[];
};

export type CreateCompetitorSnapshotBody = {
  source_id: number;
  observed_at: string;
  kind: 'fact' | 'hypothesis';
  fact?: CompetitorFact;
  limitation_note?: string | null;
};

export const STUDY_METHODS = ['survey', 'idi', 'fgd', 'diary'] as const;
export type StudyMethod = (typeof STUDY_METHODS)[number];

export const STUDY_MODES = ['online', 'f2f', 'phone', 'mixed'] as const;
export type StudyMode = (typeof STUDY_MODES)[number];

export const CONSENT_TYPES = ['record', 'quote', 'store'] as const;
export type ConsentType = (typeof CONSENT_TYPES)[number];

export const STUDY_METHOD_LABELS: Record<StudyMethod, string> = {
  survey: 'Khảo sát',
  idi: 'IDI',
  fgd: 'FGD',
  diary: 'Nhật ký',
};

export const STUDY_MODE_LABELS: Record<StudyMode, string> = {
  online: 'Online',
  f2f: 'Trực tiếp',
  phone: 'Điện thoại',
  mixed: 'Hỗn hợp',
};

export const CONSENT_TYPE_LABELS: Record<ConsentType, string> = {
  record: 'Ghi âm',
  quote: 'Trích dẫn',
  store: 'Lưu trữ',
};

export type ResearchStudy = {
  id: number;
  project_id: number;
  name: string;
  method: StudyMethod;
  n: number | null;
  field_start: string | null;
  field_end: string | null;
  mode: StudyMode | null;
  instrument_version: string | null;
  weighting_note: string | null;
};

export type ResearchConsent = {
  id: number;
  study_id: number;
  project_id: number;
  subject_code: string;
  consent_type: ConsentType;
  recorded_at: string;
  expires_at: string;
  notes: string | null;
};

export type CreateStudyBody = {
  name: string;
  method: StudyMethod;
  n?: number | null;
  field_start?: string | null;
  field_end?: string | null;
  mode?: StudyMode | null;
  instrument_version?: string | null;
  weighting_note?: string | null;
};

export type CreateConsentBody = {
  subject_code: string;
  consent_type: ConsentType;
  notes?: string | null;
};

export type ResearchWave = {
  id: number;
  project_id: number;
  wave_no: number;
  label: string | null;
  field_start: string | null;
  field_end: string | null;
  metric_json: { key: string; value: number | null }[];
  created_at: string;
};

export type WaveCompareRow = {
  key: string;
  prev: number | null;
  curr: number | null;
  delta: number | null;
};

export type CreateWaveBody = {
  wave_no: number;
  label?: string | null;
  field_start?: string | null;
  field_end?: string | null;
  metric_json: { key: string; value: number | null }[];
};

export type VwBin = {
  price: number;
  too_cheap: number;
  cheap: number;
  expensive: number;
  too_expensive: number;
};

export type VwPoints = {
  pmc: number | null;
  pme: number | null;
  opp: number | null;
  idp: number | null;
};

export type VwSummary = {
  n: number;
  unit: string;
  bins: VwBin[];
  points: VwPoints;
  limitation_note: string;
  statistical_inference: false;
};

export type ResearchVwSummaryRow = VwSummary & {
  id: number;
  project_id: number;
  study_id: number | null;
  created_by: string | null;
  created_at: string;
};

export const VW_LIMITATION =
  'Van Westendorp trên mẫu convenience — không phải census. Không ghi MOE / 95% confidence.';

export type CjLevelShare = {
  label: string;
  count: number;
  share_pct: number;
};

export type CjAttributeSummary = {
  name: string;
  levels: CjLevelShare[];
  top_level: string | null;
};

export type CjRecommendation = {
  levels: Array<{ attribute: string; level: string; share_pct: number }>;
};

export type CjSummary = {
  n: number;
  n_choices: number;
  attributes: CjAttributeSummary[];
  recommendation: CjRecommendation;
  limitation_note: string;
  statistical_inference: false;
};

export type ResearchCjSummaryRow = CjSummary & {
  id: number;
  project_id: number;
  study_id: number | null;
  created_by: string | null;
  created_at: string;
};

export const CJ_LIMITATION =
  'Conjoint lite trên mẫu convenience — đếm mức được chọn theo thuộc tính, không mô hình hoá tương tác. Không market simulator. Không ghi MOE / 95% confidence.';

export type CreateConjointBody = {
  study_id?: number | null;
};

export type CjWhatIfResult = {
  n_match: number;
  n_choices: number;
  match_pct: number;
  scenario: Record<string, string>;
  limitation_note: string;
  statistical_inference: false;
  run_id?: number;
  persisted_at?: string;
};

export type CjWhatIfRunRow = {
  id: number;
  project_id: number;
  study_id: number | null;
  scenario: Record<string, string>;
  n_match: number;
  n_choices: number;
  match_pct: number;
  limitation_note: string;
  statistical_inference: false;
  created_by: string | null;
  created_at: string;
};

export type SimulateConjointWhatIfBody = {
  study_id?: number | null;
  scenario: Record<string, string>;
  persist?: boolean;
};

export type CreateVanWestendorpBody = {
  study_id?: number | null;
};

export const DECISION_STATUSES = ['open', 'done', 'dropped'] as const;
export type DecisionStatus = (typeof DECISION_STATUSES)[number];

export const DECISION_STATUS_LABELS: Record<DecisionStatus, string> = {
  open: 'Mở',
  done: 'Xong',
  dropped: 'Bỏ',
};

export const APPROVED_INTERNAL_PLUS: InsightStatus[] = [
  'approved_internal',
  'approved_client_facing',
  'published',
];

export type ResearchDecision = {
  id: number;
  project_id: number;
  insight_id: number;
  decision_text: string;
  owner_email: string;
  due_at: string | null;
  status: DecisionStatus;
  created_by: string | null;
  created_at: string;
};

export type CreateDecisionBody = {
  insight_id: number;
  decision_text: string;
  owner_email: string;
  due_at?: string | null;
};

export type PatchDecisionBody = {
  status?: DecisionStatus;
  due_at?: string | null;
  owner_email?: string;
};

export type ResearchSource = {
  id: number;
  project_id: number;
  question_id: number | null;
  source_type: string;
  title: string;
  publisher: string | null;
  url: string | null;
  published_at: string | null;
  accessed_at: string | null;
  geo: string | null;
  license_note: string | null;
  reliability_tier: string;
  ai_generated: boolean;
  keep: boolean | null;
  triangulated?: boolean;
  single_source_accepted?: boolean;
  superseded_by: number | null;
  created_at: string;
  updated_at: string;
};

export type ResearchEvidence = {
  id: number;
  project_id: number;
  source_id: number | null;
  study_id: number | null;
  question_id: number | null;
  locator: string;
  excerpt: string | null;
  value_num: number | null;
  unit: string | null;
  value_base: string | null;
  period_note: string | null;
  geography: string | null;
  captured_at: string;
  pii_class: string;
  qc_status: string;
  checksum: string | null;
  created_by: string | null;
  superseded_by: number | null;
  created_at: string;
  pii_warning?: boolean;
};

export type CreateSourceBody = {
  title: string;
  source_type?: string;
  publisher?: string;
  url?: string;
  published_at?: string;
  accessed_at?: string;
  geo?: string;
  license_note?: string;
  reliability_tier?: string;
  question_id?: number | null;
};

export type CreateEvidenceBody = {
  source_id?: number | null;
  study_id?: number | null;
  question_id?: number | null;
  locator: string;
  excerpt?: string | null;
  value_num?: number | null;
  unit?: string | null;
  value_base?: string | null;
  period_note?: string | null;
  geography?: string | null;
  pii_class?: string | null;
};

export type ResearchPrefill = {
  industry: string | null;
  competitor_names: string[];
  suggested_rqs: string[];
};

export type OpsAnalytics = {
  cycle_time_hours: {
    designed_to_approved_p50: number | null;
    sample: number;
  };
  evidence_completeness: {
    projects: number;
    with_verified_pct: number;
  };
  activation: {
    distributed_projects: number;
    approved_reports: number;
  };
};

export type OpsAnalyticsProject = {
  id: number;
  client_id: string;
  status: ProjectStatus;
  verified_ev: number;
};

export type OpsAnalyticsPayload = OpsAnalytics & {
  projects: OpsAnalyticsProject[];
};

export type ThemeQuarterRow = {
  quarter: number;
  theme_code: string;
  label_vi: string;
  insight_count: number;
  prev_qoq_count: number | null;
  prev_yoy_count: number | null;
  delta_qoq_pct: number | null;
  delta_yoy_pct: number | null;
};

export type ThemeQuarterAnalyticsPayload = {
  ok: true;
  year: number;
  client_id: string | null;
  corpus_statuses: readonly string[];
  rows: ThemeQuarterRow[];
};

export type CreateProjectBody = {
  client_id: string;
  title: string;
  product_type: ProductType;
  dv12_tier: 'CB' | 'TC' | 'CS';
  decision_statement: string;
  geo: string[];
  languages: string[];
  risk_class: 'low' | 'medium' | 'high';
  lifecycle_id?: number | null;
  questions: Array<{ question_vi: string; question_en?: string; sort_order?: number }>;
  prefill_competitors?: string[];
};

async function researchFetch<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  const isForm = typeof FormData !== 'undefined' && init?.body instanceof FormData;
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      ...(isForm ? { Authorization: `Bearer ${token}` } : authHeaders(token)),
      ...(isForm ? {} : (init?.headers ?? {})),
    },
  });
  const body = await parseJson<
    T & {
      error?: string;
      message?: string | { error?: string; messages?: string[]; reason?: string };
      messages?: string[];
      reason?: string;
    }
  >(res);
  if (!res.ok) {
    const nested = typeof body.message === 'object' && body.message ? body.message : null;
    const errorCode = nested?.error ?? body.error;
    const messages = body.messages ?? nested?.messages;
    const reason = body.reason ?? nested?.reason;
    const detail =
      messages?.join(' · ') ??
      (reason ? TRANSITION_REASON_VI[reason] ?? reason : undefined) ??
      (typeof body.message === 'string' ? body.message : undefined) ??
      (errorCode ? TRANSITION_REASON_VI[errorCode] ?? errorCode : undefined) ??
      'Yêu cầu nghiên cứu thất bại';
    throw new ResearchApiError(detail, res.status, errorCode, messages);
  }
  return body;
}

export async function fetchResearchPrefill(
  token: string,
  clientId: string,
): Promise<ResearchPrefill> {
  const qs = new URLSearchParams();
  if (clientId.trim()) qs.set('client_id', clientId.trim());
  return researchFetch(token, `/api/v1/research/prefill?${qs.toString()}`);
}

export async function fetchResearchOpsAnalytics(
  token: string,
  params?: { client_id?: string },
): Promise<OpsAnalyticsPayload> {
  const qs = new URLSearchParams();
  if (params?.client_id) qs.set('client_id', params.client_id);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return researchFetch(token, `/api/v1/research/analytics/ops${suffix}`);
}

export async function fetchResearchThemeQuarterAnalytics(
  token: string,
  params?: { client_id?: string; year?: number },
): Promise<ThemeQuarterAnalyticsPayload> {
  const qs = new URLSearchParams();
  if (params?.client_id) qs.set('client_id', params.client_id);
  if (params?.year != null) qs.set('year', String(params.year));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return researchFetch(token, `/api/v1/research/analytics/themes${suffix}`);
}

export async function fetchResearchProjects(
  token: string,
  params?: { client_id?: string; status?: string; product_type?: string; q?: string; lifecycle_id?: string | number },
): Promise<{ projects: ResearchProject[] }> {
  const qs = new URLSearchParams();
  if (params?.client_id) qs.set('client_id', params.client_id);
  if (params?.status) qs.set('status', params.status);
  if (params?.product_type) qs.set('product_type', params.product_type);
  if (params?.q) qs.set('q', params.q);
  if (params?.lifecycle_id != null && params.lifecycle_id !== '') {
    qs.set('lifecycle_id', String(params.lifecycle_id));
  }
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return researchFetch(token, `/api/v1/research/projects${suffix}`);
}

export async function createResearchProject(
  token: string,
  body: CreateProjectBody,
): Promise<{ ok: true; project: ResearchProject }> {
  return researchFetch(token, '/api/v1/research/projects', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function fetchResearchProject(token: string, id: number): Promise<ResearchProject> {
  return researchFetch(token, `/api/v1/research/projects/${id}`);
}

export async function fetchResearchIsoGap(
  token: string,
  projectId: number,
): Promise<IsoGapCheckPayload> {
  return researchFetch(token, `/api/v1/research/projects/${projectId}/governance/iso-gap`);
}

export async function patchResearchProject(
  token: string,
  id: number,
  body: Partial<CreateProjectBody> & { status?: ProjectStatus },
): Promise<ResearchProject> {
  return researchFetch(token, `/api/v1/research/projects/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export async function addResearchQuestion(
  token: string,
  projectId: number,
  body: { question_vi: string; question_en?: string },
): Promise<ResearchQuestion> {
  return researchFetch(token, `/api/v1/research/projects/${projectId}/questions`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function patchResearchQuestion(
  token: string,
  questionId: number,
  body: { question_vi?: string; question_en?: string | null },
): Promise<ResearchQuestion> {
  return researchFetch(token, `/api/v1/research/questions/${questionId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export async function deleteResearchQuestion(token: string, questionId: number): Promise<{ ok: true }> {
  return researchFetch(token, `/api/v1/research/questions/${questionId}`, { method: 'DELETE' });
}

export async function runResearchDesk(
  token: string,
  projectId: number,
  questionId: number,
): Promise<{ ok: true; run_id: number; status: string; note?: string }> {
  return researchFetch(token, `/api/v1/research/projects/${projectId}/run-desk`, {
    method: 'POST',
    body: JSON.stringify({ question_id: questionId }),
  });
}

export async function fetchResearchHealth(
  token: string,
): Promise<{
  ok: true;
  enabled: true;
  deep_provider: string;
  sparktoro_enabled: boolean;
  talkwalker_enabled: boolean;
  talkwalker_live_enabled?: boolean;
  qualtrics_enabled: boolean;
  rag_enabled: boolean;
  rag_openai_embed_enabled: boolean;
  rag_embed_model: 'openai' | 'local';
  rag_pgvector_enabled?: boolean;
  rag_pgvector_ready?: boolean;
  rag_ivfflat_ready?: boolean;
}> {
  return researchFetch(token, '/api/v1/research/health');
}

export type RagReembedPreview = {
  ok: true;
  stale_count: number;
  target_dims: number;
  target_model: string;
};

export type RagReembedStart = {
  ok: true;
  run_id?: number;
  status: 'pending' | 'succeeded' | 'failed' | 'noop' | string;
  note?: 'jobs_disabled' | 'rag_reembed_disabled' | 'rag_disabled' | string;
  processed?: number;
  skipped_pii?: number;
  failed?: number;
  remaining?: number;
};

export async function previewResearchRagReembed(
  token: string,
  params?: { client_id?: string },
): Promise<RagReembedPreview> {
  const qs = new URLSearchParams();
  if (params?.client_id?.trim()) qs.set('client_id', params.client_id.trim());
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return researchFetch(token, `/api/v1/research/rag/reembed/preview${suffix}`);
}

export async function startResearchRagReembed(
  token: string,
  body: { limit?: number; client_id?: string },
): Promise<RagReembedStart> {
  return researchFetch(token, '/api/v1/research/rag/reembed', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export type ResearchRagHit = {
  insight_id: number;
  project_id: number;
  statement: string;
  status: 'approved_client_facing' | 'published';
  score: number;
  theme_codes: string[];
  valid_to?: string | null;
  is_stale?: boolean;
};

export type ResearchRagSearchResult = {
  hits: ResearchRagHit[];
  note?: 'rag_disabled';
};

export async function searchResearchInsights(
  token: string,
  params: { q: string; theme_code?: string; client_id?: string; limit?: number; stale_only?: boolean },
): Promise<ResearchRagSearchResult> {
  const qs = new URLSearchParams();
  qs.set('q', params.q);
  if (params.theme_code) qs.set('theme_code', params.theme_code);
  if (params.client_id) qs.set('client_id', params.client_id);
  if (params.limit != null) qs.set('limit', String(params.limit));
  if (params.stale_only) qs.set('stale_only', '1');
  return researchFetch(token, `/api/v1/research/insights/search?${qs.toString()}`);
}

export type ResearchTaxonomyTheme = {
  id: number;
  theme_code: string;
  label_vi: string;
  synonyms: string[];
  active: boolean;
};

export async function fetchResearchTaxonomy(
  token: string,
): Promise<{ themes: ResearchTaxonomyTheme[] }> {
  return researchFetch(token, '/api/v1/research/taxonomy');
}

export async function createResearchTaxonomy(
  token: string,
  body: { theme_code: string; label_vi: string; synonyms?: string[] },
): Promise<ResearchTaxonomyTheme> {
  return researchFetch(token, '/api/v1/research/taxonomy', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function attachResearchInsightTheme(
  token: string,
  insightId: number,
  taxonomyId: number,
): Promise<ResearchInsight> {
  return researchFetch(token, `/api/v1/research/insights/${insightId}/themes`, {
    method: 'POST',
    body: JSON.stringify({ taxonomy_id: taxonomyId }),
  });
}

export async function runResearchDeep(
  token: string,
  projectId: number,
  questionId: number,
): Promise<{ ok: true; run_id: number; status: string; note?: string }> {
  return researchFetch(token, `/api/v1/research/projects/${projectId}/run-deep`, {
    method: 'POST',
    body: JSON.stringify({ question_id: questionId }),
  });
}

export async function runResearchTriangulate(
  token: string,
  projectId: number,
  questionId: number,
): Promise<{ ok: true; run_id: number; status: string; note?: string }> {
  return researchFetch(
    token,
    `/api/v1/research/projects/${projectId}/questions/${questionId}/run-triangulate`,
    { method: 'POST' },
  );
}

export async function runResearchPulse(
  token: string,
  projectId: number,
  questionId?: number | null,
): Promise<{ ok: true; run_id: number; status: string; note?: string }> {
  return researchFetch(token, `/api/v1/research/projects/${projectId}/run-pulse`, {
    method: 'POST',
    body: JSON.stringify(questionId ? { question_id: questionId } : {}),
  });
}

export async function runResearchSparktoro(
  token: string,
  projectId: number,
  questionId: number,
): Promise<{ ok: true; run_id?: number; status?: string; note?: string }> {
  return researchFetch(token, `/api/v1/research/projects/${projectId}/run-sparktoro`, {
    method: 'POST',
    body: JSON.stringify({ question_id: questionId }),
  });
}

export async function runResearchTalkwalker(
  token: string,
  projectId: number,
  questionId: number,
): Promise<{ ok: true; run_id?: number; status?: string; note?: string }> {
  return researchFetch(token, `/api/v1/research/projects/${projectId}/run-talkwalker`, {
    method: 'POST',
    body: JSON.stringify({ question_id: questionId }),
  });
}

export async function runResearchQualtrics(
  token: string,
  projectId: number,
  body: { study_id: number; column_map?: Record<string, unknown> },
): Promise<{ ok: true; note?: 'qualtrics_disabled'; run_id?: number; status?: string; evidence_ids?: number[] }> {
  return researchFetch(token, `/api/v1/research/projects/${projectId}/run-qualtrics`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function fetchResearchJob(
  token: string,
  projectId: number,
  runId: number,
): Promise<ResearchAiRun> {
  return researchFetch(token, `/api/v1/research/projects/${projectId}/jobs/${runId}`);
}

export type WhisperIngestClientResult = {
  ok: true;
  run_id: number;
  study_id: number;
  excerpt_ids: number[];
  status?: string;
  note?: string;
};

export async function ingestResearchWhisper(
  token: string,
  projectId: number,
  studyId: number,
  file: File,
): Promise<WhisperIngestClientResult> {
  const form = new FormData();
  form.append('file', file);
  return researchFetch(
    token,
    `/api/v1/research/projects/${projectId}/studies/${studyId}/whisper`,
    { method: 'POST', body: form },
  );
}

export type SurveyImportResult = {
  ok: true;
  study_id: number;
  source_id: number;
  evidence_ids: number[];
  n: number;
};

export async function importResearchSurvey(
  token: string,
  projectId: number,
  formData: FormData,
): Promise<SurveyImportResult> {
  return researchFetch(token, `/api/v1/research/projects/${projectId}/import-survey`, {
    method: 'POST',
    body: formData,
  });
}

export async function createResearchSource(
  token: string,
  projectId: number,
  body: CreateSourceBody,
): Promise<ResearchSource> {
  return researchFetch(token, `/api/v1/research/projects/${projectId}/sources`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function patchResearchSourceKeep(
  token: string,
  sourceId: number,
  keep: boolean,
): Promise<ResearchSource> {
  return researchFetch(token, `/api/v1/research/sources/${sourceId}`, {
    method: 'PATCH',
    body: JSON.stringify({ keep }),
  });
}

export async function createResearchEvidence(
  token: string,
  projectId: number,
  body: CreateEvidenceBody,
): Promise<ResearchEvidence> {
  return researchFetch(token, `/api/v1/research/projects/${projectId}/evidence`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function patchResearchEvidence(
  token: string,
  evidenceId: number,
  body: Partial<CreateEvidenceBody>,
): Promise<ResearchEvidence> {
  return researchFetch(token, `/api/v1/research/evidence/${evidenceId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export async function verifyResearchEvidence(
  token: string,
  evidenceId: number,
): Promise<ResearchEvidence> {
  return researchFetch(token, `/api/v1/research/evidence/${evidenceId}/verify`, { method: 'POST' });
}

export async function supersedeResearchEvidence(
  token: string,
  evidenceId: number,
  body: CreateEvidenceBody,
): Promise<{ old: ResearchEvidence; evidence: ResearchEvidence }> {
  return researchFetch(token, `/api/v1/research/evidence/${evidenceId}/supersede`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function createResearchInsight(
  token: string,
  projectId: number,
  body: CreateInsightBody,
): Promise<ResearchInsight> {
  return researchFetch(token, `/api/v1/research/projects/${projectId}/insights`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function patchResearchInsight(
  token: string,
  insightId: number,
  body: Partial<CreateInsightBody>,
): Promise<ResearchInsight> {
  return researchFetch(token, `/api/v1/research/insights/${insightId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export async function attachResearchInsightEvidence(
  token: string,
  insightId: number,
  evidenceIds: number[],
): Promise<ResearchInsight> {
  return researchFetch(token, `/api/v1/research/insights/${insightId}/attach-evidence`, {
    method: 'POST',
    body: JSON.stringify({ evidence_ids: evidenceIds }),
  });
}

export type SubmitInsightReviewBody = {
  confidence_json?: ConfidenceRubric;
  confidence_rationale?: string | null;
};

export async function submitResearchInsightReview(
  token: string,
  insightId: number,
  body?: SubmitInsightReviewBody,
): Promise<ResearchInsight> {
  return researchFetch(token, `/api/v1/research/insights/${insightId}/submit-review`, {
    method: 'POST',
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

export async function approveResearchInsight(
  token: string,
  insightId: number,
  body: { target_status: InsightStatus; comments?: string },
): Promise<ResearchInsight> {
  return researchFetch(token, `/api/v1/research/insights/${insightId}/approve`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export type InsightCopilotRagHit = {
  insight_id: number;
  statement: string;
  status: string;
  score: number;
  theme_codes: string[];
};

export type InsightCopilotRagNote = 'rag_disabled' | 'rag_skipped_pii' | 'rag_empty';

export async function copilotResearchInsight(
  token: string,
  projectId: number,
  evidenceIds: number[],
): Promise<{
  ok: true;
  insight: ResearchInsight;
  run_id: number;
  rag_hits: InsightCopilotRagHit[];
  rag_note?: InsightCopilotRagNote;
}> {
  return researchFetch(token, `/api/v1/research/projects/${projectId}/insights/copilot`, {
    method: 'POST',
    body: JSON.stringify({ evidence_ids: evidenceIds }),
  });
}

export type ResearchReportVersion = {
  id: number;
  report_id: number;
  version: number;
  content_snapshot: ResearchReportSnapshot;
  generated_by: string | null;
  content_hash: string;
  embargo_until: string | null;
  expires_at: string | null;
  portal_visible: boolean;
  published_by?: string | null;
  published_at?: string | null;
  created_at: string;
  has_stale_insights?: boolean;
};

export type ResearchReport = {
  id: number;
  project_id: number;
  template: string;
  status: string;
  created_at: string;
  versions: ResearchReportVersion[];
};

export async function fetchResearchReports(
  token: string,
  projectId: number,
): Promise<{ reports: ResearchReport[] }> {
  return researchFetch(token, `/api/v1/research/projects/${projectId}/reports`);
}

export async function createResearchReport(
  token: string,
  projectId: number,
  insightIds: number[],
  methodology?: MethodologyBlock,
): Promise<{
  ok: true;
  report_id: number;
  version_id: number;
  version: number;
  content_snapshot: ResearchReportSnapshot;
  content_hash: string;
}> {
  return researchFetch(token, `/api/v1/research/projects/${projectId}/reports`, {
    method: 'POST',
    body: JSON.stringify({ insight_ids: insightIds, methodology }),
  });
}

export async function exportResearchReportVersion(
  token: string,
  reportId: number,
  versionId: number,
  format: 'docx' | 'pdf' = 'docx',
): Promise<{ blob: Blob; filename: string }> {
  const qs = format === 'pdf' ? '?format=pdf' : '';
  const res = await fetch(
    `${API_BASE}/api/v1/research/reports/${reportId}/versions/${versionId}/export${qs}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) {
    const body = await parseJson<{ error?: string; message?: string }>(res);
    throw new ResearchApiError(
      body.message ?? body.error ?? `Export failed (${res.status})`,
      res.status,
      body.error,
    );
  }
  const cd = res.headers.get('content-disposition') ?? '';
  const match = /filename="([^"]+)"/.exec(cd);
  const filename = match?.[1] ?? `research-report-${reportId}.${format === 'pdf' ? 'pdf' : 'docx'}`;
  return { blob: await res.blob(), filename };
}

export type PlanInsightSnapshot = {
  client_id: string;
  insight_ids: number[];
  inserted_at: string;
  inserted_by: string;
};

export async function fetchApprovedInsightsForClient(
  token: string,
  clientId: string,
): Promise<{ insights: ResearchInsight[] }> {
  const qs = new URLSearchParams({ client_id: clientId });
  return researchFetch(token, `/api/v1/research/insights?${qs.toString()}`);
}

export async function insertPlanInsights(
  token: string,
  planId: number,
  body: { client_id: string; insight_ids: number[] },
): Promise<{ ok: true; snapshot: PlanInsightSnapshot }> {
  return researchFetch(token, `/api/v1/research/plans/${planId}/insights`, {
    method: 'POST',
    body: JSON.stringify({
      client_id: body.client_id,
      insight_ids: body.insight_ids,
    }),
  });
}

export async function insertContentInsights(
  token: string,
  itemId: number,
  body: { client_id: string; insight_ids: number[] },
): Promise<{ ok: true; snapshot: PlanInsightSnapshot }> {
  return researchFetch(token, `/api/v1/research/content-items/${itemId}/insights`, {
    method: 'POST',
    body: JSON.stringify({
      client_id: body.client_id,
      insight_ids: body.insight_ids,
    }),
  });
}

export function parsePlanInsightSnapshot(raw: unknown): PlanInsightSnapshot | null {
  let obj: unknown = raw;
  if (typeof raw === 'string') {
    const text = raw.trim();
    if (!text || text === '{}') return null;
    try {
      obj = JSON.parse(text);
    } catch {
      return null;
    }
  }
  if (!obj || typeof obj !== 'object') return null;
  const rec = obj as Record<string, unknown>;
  const ids = Array.isArray(rec.insight_ids)
    ? rec.insight_ids.map(Number).filter((n) => Number.isFinite(n) && n > 0)
    : [];
  if (!ids.length) return null;
  return {
    client_id: String(rec.client_id ?? ''),
    insight_ids: ids,
    inserted_at: String(rec.inserted_at ?? ''),
    inserted_by: String(rec.inserted_by ?? ''),
  };
}

export async function fetchResearchCompetitors(
  token: string,
  projectId: number,
): Promise<{ competitors: ResearchCompetitor[] }> {
  return researchFetch(token, `/api/v1/research/projects/${projectId}/competitors`);
}

export async function createResearchCompetitor(
  token: string,
  projectId: number,
  body: CreateCompetitorBody,
): Promise<ResearchCompetitor> {
  return researchFetch(token, `/api/v1/research/projects/${projectId}/competitors`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function patchResearchCompetitor(
  token: string,
  competitorId: number,
  body: { name?: string; aliases?: string[] },
): Promise<ResearchCompetitor> {
  return researchFetch(token, `/api/v1/research/competitors/${competitorId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export async function createResearchCompetitorSnapshot(
  token: string,
  competitorId: number,
  body: CreateCompetitorSnapshotBody,
): Promise<ResearchCompetitorSnapshot> {
  return researchFetch(token, `/api/v1/research/competitors/${competitorId}/snapshots`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function fetchResearchStudies(
  token: string,
  projectId: number,
): Promise<{ studies: ResearchStudy[] }> {
  return researchFetch(token, `/api/v1/research/projects/${projectId}/studies`);
}

export async function createResearchStudy(
  token: string,
  projectId: number,
  body: CreateStudyBody,
): Promise<ResearchStudy> {
  return researchFetch(token, `/api/v1/research/projects/${projectId}/studies`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function patchResearchStudy(
  token: string,
  studyId: number,
  body: Partial<CreateStudyBody>,
): Promise<ResearchStudy> {
  return researchFetch(token, `/api/v1/research/studies/${studyId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export async function fetchResearchConsents(
  token: string,
  studyId: number,
): Promise<{ consents: ResearchConsent[] }> {
  return researchFetch(token, `/api/v1/research/studies/${studyId}/consents`);
}

export async function createResearchConsent(
  token: string,
  studyId: number,
  body: CreateConsentBody,
): Promise<ResearchConsent> {
  return researchFetch(token, `/api/v1/research/studies/${studyId}/consents`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function fetchResearchWaves(
  token: string,
  projectId: number,
): Promise<{ waves: ResearchWave[]; compare: WaveCompareRow[] }> {
  return researchFetch(token, `/api/v1/research/projects/${projectId}/waves`);
}

export async function createResearchWave(
  token: string,
  projectId: number,
  body: CreateWaveBody,
): Promise<ResearchWave> {
  return researchFetch(token, `/api/v1/research/projects/${projectId}/waves`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function fetchResearchVanWestendorp(
  token: string,
  projectId: number,
): Promise<{ summary: ResearchVwSummaryRow | null }> {
  return researchFetch(token, `/api/v1/research/projects/${projectId}/van-westendorp`);
}

export async function createResearchVanWestendorp(
  token: string,
  projectId: number,
  body: CreateVanWestendorpBody = {},
): Promise<ResearchVwSummaryRow> {
  return researchFetch(token, `/api/v1/research/projects/${projectId}/van-westendorp`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function fetchResearchConjoint(
  token: string,
  projectId: number,
): Promise<{ summary: ResearchCjSummaryRow | null }> {
  return researchFetch(token, `/api/v1/research/projects/${projectId}/conjoint`);
}

export async function createResearchConjoint(
  token: string,
  projectId: number,
  body: CreateConjointBody = {},
): Promise<ResearchCjSummaryRow> {
  return researchFetch(token, `/api/v1/research/projects/${projectId}/conjoint`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function simulateResearchConjointWhatIf(
  token: string,
  projectId: number,
  body: SimulateConjointWhatIfBody,
): Promise<CjWhatIfResult> {
  return researchFetch(token, `/api/v1/research/projects/${projectId}/conjoint/what-if`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function fetchResearchConjointWhatIfRuns(
  token: string,
  projectId: number,
): Promise<{ runs: CjWhatIfRunRow[] }> {
  return researchFetch(token, `/api/v1/research/projects/${projectId}/conjoint/what-if`);
}

export async function fetchResearchDecisions(
  token: string,
  projectId: number,
): Promise<{ decisions: ResearchDecision[] }> {
  return researchFetch(token, `/api/v1/research/projects/${projectId}/decisions`);
}

export async function createResearchDecision(
  token: string,
  projectId: number,
  body: CreateDecisionBody,
): Promise<ResearchDecision> {
  return researchFetch(token, `/api/v1/research/projects/${projectId}/decisions`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function patchResearchDecision(
  token: string,
  decisionId: number,
  body: PatchDecisionBody,
): Promise<ResearchDecision> {
  return researchFetch(token, `/api/v1/research/decisions/${decisionId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export async function updateResearchReportExecEn(
  token: string,
  reportId: number,
  versionId: number,
  en: string,
): Promise<ResearchReportVersion> {
  return researchFetch(token, `/api/v1/research/reports/${reportId}/versions/${versionId}/exec-en`, {
    method: 'POST',
    body: JSON.stringify({ en }),
  });
}

export async function approveResearchReportExecEn(
  token: string,
  reportId: number,
  versionId: number,
): Promise<ResearchReportVersion> {
  return researchFetch(
    token,
    `/api/v1/research/reports/${reportId}/versions/${versionId}/approve-exec-en`,
    { method: 'POST' },
  );
}

export async function updateResearchReportEmbargo(
  token: string,
  reportId: number,
  versionId: number,
  body: { embargo_until?: string | null; expires_at?: string | null },
): Promise<ResearchReportVersion> {
  return researchFetch(token, `/api/v1/research/reports/${reportId}/versions/${versionId}/embargo`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export async function publishResearchReportPortal(
  token: string,
  reportId: number,
  versionId: number,
  visible: boolean,
): Promise<ResearchReportVersion> {
  return researchFetch(
    token,
    `/api/v1/research/reports/${reportId}/versions/${versionId}/publish-portal`,
    { method: 'POST', body: JSON.stringify({ visible }) },
  );
}

export async function copilotResearchReport(
  token: string,
  projectId: number,
  insightIds: number[],
): Promise<{
  ok: true;
  report_id: number;
  version: number;
  content_snapshot: ResearchReportSnapshot;
  run_id: number;
}> {
  return researchFetch(token, `/api/v1/research/projects/${projectId}/reports/copilot`, {
    method: 'POST',
    body: JSON.stringify({ insight_ids: insightIds }),
  });
}
