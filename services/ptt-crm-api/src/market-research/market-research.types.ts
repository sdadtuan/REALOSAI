import type { InsightStatus, ProductType, ProjectStatus } from './market-research.constants';

export type Dv12Tier = 'CB' | 'TC' | 'CS';
export type RiskClass = 'low' | 'medium' | 'high';
export type ResearchExportFormat = 'docx' | 'pdf';

export const RUBRIC_DIMS = ['S', 'F', 'T', 'A', 'R'] as const;
export type RubricDim = (typeof RUBRIC_DIMS)[number];

export type ConfidenceRubric = {
  S: number; // source quality 0–4
  F: number; // fit & coverage
  T: number; // triangulation
  A: number; // analytical robustness
  R: number; // recency & stability
  statistical_inference?: boolean;
};

export type ConfidenceBand = 'low' | 'medium' | 'high' | 'very_high';

export type ConfidenceJson = {
  rubric: ConfidenceRubric;
  score: number;
  band: ConfidenceBand;
  override_down?: boolean;
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

export type CompetitorFact = Partial<Record<(typeof COMPETITOR_FACT_KEYS)[number], string | number | null>>;

export type PlanInsightSnapshot = {
  client_id: string;
  insight_ids: number[];
  inserted_at: string;
  inserted_by: string;
};

export type MethodologyBlock = {
  population: string;
  source_plan: string;
  limitation: string;
  stub?: boolean;
};

export type InsertPlanInsightsInput = {
  client_id: string;
  insight_ids: number[];
};

export type CreateCompetitorInput = {
  name: string;
  aliases?: string[];
};

export type PatchCompetitorInput = {
  name?: string;
  aliases?: string[];
};

export type CreateCompetitorSnapshotInput = {
  source_id?: number;
  observed_at?: string;
  kind?: string;
  fact?: unknown;
  limitation_note?: string | null;
};

export type ResearchCompetitorSnapshotRow = {
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

export type ResearchCompetitorRow = {
  id: number;
  project_id: number;
  name: string;
  aliases: string[];
  created_by: string | null;
  created_at: string;
  updated_at: string;
  snapshots: ResearchCompetitorSnapshotRow[];
};

export const STUDY_METHODS = ['survey', 'idi', 'fgd', 'diary'] as const;
export type StudyMethod = (typeof STUDY_METHODS)[number];

export const STUDY_MODES = ['online', 'f2f', 'phone', 'mixed'] as const;
export type StudyMode = (typeof STUDY_MODES)[number];

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
  subject_code: string; // pseudonym R-004 — not a person name
  consent_type: 'record' | 'quote' | 'store';
  recorded_at: string;
  expires_at: string;
  notes: string | null;
};

export type ReportExec = {
  vi: string;
  en: string | null;
  en_status: 'none' | 'draft' | 'approved';
};

export type TrendSignal = {
  id: number;
  project_id: number;
  topic: string;
  metric: string;
  baseline: number | null;
  current: number | null;
  velocity: number | null;
  lifecycle: 'new' | 'rising' | 'stable' | 'fading';
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

export type OpsAnalyticsProjectRow = {
  id: number;
  client_id: string;
  status: ProjectStatus;
  verified_ev: number;
};

export type OpsAnalyticsPayload = OpsAnalytics & {
  projects: OpsAnalyticsProjectRow[];
};

export type OpsAnalyticsRaw = {
  cycleHours: number[];
  totalProjects: number;
  withVerified: number;
  distributedProjects: number;
  approvedReports: number;
  projects: OpsAnalyticsProjectRow[];
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

export type IsoGapFactsRow = {
  decision_statement: string;
  product_type: string;
  dv12_tier: string;
  geo: unknown;
  rq_count: number;
  source_count: number;
  verified_evidence_count: number;
  study_count: number;
  ai_run_count: number;
  review_count: number;
  draft_count: number;
  published_count: number;
  acf_count: number;
  acf_with_verified_evidence: number;
  report_version_count: number;
  latest_report_methodology: Record<string, unknown> | null;
  latest_report_findings_count: number;
};

export type ThemeQuarterCountRow = {
  quarter: number;
  theme_code: string;
  label_vi: string;
  insight_count: number;
};

export type ThemeQuarterRow = ThemeQuarterCountRow & {
  prev_qoq_count: number | null;
  prev_yoy_count: number | null;
  delta_qoq_pct: number | null;
  delta_yoy_pct: number | null;
};

export type ThemeQuarterAnalyticsPayload = {
  ok: true;
  year: number;
  client_id: string | null;
  corpus_statuses: readonly RagCorpusStatus[];
  rows: ThemeQuarterRow[];
};

export const CONSENT_TYPES = ['record', 'quote', 'store'] as const;
export type ConsentType = (typeof CONSENT_TYPES)[number];

export type CreateStudyInput = {
  name: string;
  method: string;
  n?: number | null;
  field_start?: string | null;
  field_end?: string | null;
  mode?: string | null;
  instrument_version?: string | null;
  weighting_note?: string | null;
};

export type PatchStudyInput = {
  name?: string;
  n?: number | null;
  field_start?: string | null;
  field_end?: string | null;
  mode?: string | null;
  instrument_version?: string | null;
  weighting_note?: string | null;
};

export type CreateConsentInput = {
  subject_code: string;
  consent_type: string;
  notes?: string | null;
};

export type CreateProjectQuestionInput = {
  question_vi: string;
  question_en?: string | null;
  analysis_frame?: string | null;
  sort_order?: number;
};

export type ResearchPrefill = {
  industry: string | null;
  competitor_names: string[];
  suggested_rqs: string[];
};

export type CreateProjectInput = {
  client_id: string;
  title: string;
  product_type: string;
  dv12_tier?: string;
  decision_statement: string;
  geo?: string[];
  languages?: string[];
  risk_class?: string;
  lifecycle_id?: number | null;
  questions: CreateProjectQuestionInput[];
  prefill_competitors?: string[];
};

export type PatchProjectInput = {
  title?: string;
  decision_statement?: string;
  geo?: string[];
  languages?: string[];
  risk_class?: string;
  dv12_tier?: string;
  status?: string;
};

export type CreateQuestionInput = {
  question_vi: string;
  question_en?: string | null;
  analysis_frame?: string | null;
  sort_order?: number;
};

export type PatchQuestionInput = {
  question_vi?: string;
  question_en?: string | null;
  analysis_frame?: string | null;
  sort_order?: number;
};

export type ListProjectsFilters = {
  client_id?: string;
  status?: string;
  product_type?: string;
  q?: string;
  lifecycle_id?: number;
};

export type ResearchQuestionRow = {
  id: number;
  project_id: number;
  sort_order: number;
  question_vi: string;
  question_en: string | null;
  analysis_frame: string | null;
  created_at: string;
};

export type ResearchProjectRow = {
  id: number;
  client_id: string;
  client_name: string | null;
  lifecycle_id: number | null;
  title: string;
  product_type: ProductType;
  dv12_tier: Dv12Tier;
  decision_statement: string;
  geo: string[];
  languages: string[];
  risk_class: RiskClass;
  status: ProjectStatus;
  owner_user_id: number | null;
  data_residency: string | null;
  related_sales_market_id: number | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  rq_count: number;
  verified_insight_count: number;
};

export type ResearchAiRunRow = {
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

export type ResearchProjectDetail = ResearchProjectRow & {
  questions: ResearchQuestionRow[];
  sources: ResearchSourceRow[];
  evidence: ResearchEvidenceRow[];
  insights: ResearchInsightRow[];
  ai_runs: ResearchAiRunRow[];
  trend_signals: TrendSignal[];
  tavily_credits_used: number;
  tavily_credits_limit: number;
  deep_research_provider: string;
  valid_transitions: ProjectStatus[];
};

export type RunDeskInput = {
  question_id: number;
};

export type RunDeskResult = {
  ok: true;
  run_id: number;
  status: string;
  note?: string;
};

export type RunDeepInput = {
  question_id: number;
};

export type RunDeepResult = RunDeskResult;

export type RunTriangulateResult = RunDeskResult;

export type RunPulseInput = {
  question_id?: number;
};

export type RunPulseResult = RunDeskResult;

export type WhisperExcerpt = {
  locator: string; // T-mm:ss
  excerpt: string; // trim, length 1–500
};

export type WhisperIngestResult = {
  ok: true;
  run_id: number;
  study_id: number;
  excerpt_ids: number[];
  status?: string;
  note?: string;
};

export const SURVEY_IMPORT_FORMATS = ['codebook', 'vw', 'conjoint'] as const;
export type SurveyImportFormat = (typeof SURVEY_IMPORT_FORMATS)[number];

export type CodebookEvidenceDraft = {
  locator: string;
  value_num: number;
  unit: string;
  value_base: string;
  period_note: string;
  geography: string;
  respondent_id: string;
};

export type SurveyImportResult = {
  ok: true;
  study_id: number;
  source_id: number;
  evidence_ids: number[];
  n: number;
};

export const VW_BASES = ['too_cheap', 'cheap', 'expensive', 'too_expensive'] as const;
export type VwBase = (typeof VW_BASES)[number];

export type VwRespondent = {
  too_cheap: number;
  cheap: number;
  expensive: number;
  too_expensive: number;
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

export const CODEBOOK_LIMITATION =
  'Codebook Forms — không phải panel xác suất. Không suy MOE.';

export const CJ_MAX_ATTRIBUTES = 3;
export const CJ_MIN_ATTRIBUTES = 2;

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

export type CjChoice = {
  respondent_id: string;
  task_id: string;
  attributes: Record<string, string>;
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

export type CjWhatIfResult = {
  n_match: number;
  n_choices: number;
  match_pct: number;
  scenario: Record<string, string>;
  limitation_note: string;
  statistical_inference: false;
};

export type CjWhatIfPersistResult = CjWhatIfResult & {
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

export const CJ_WHATIF_LIMITATION =
  'What-if conjoint lite — đếm lựa chọn trong mẫu khớp gói giả định. Không mô hình hoá tương tác. Không market share. Không suy diễn thống kê.';

export type SparkToroSourceCandidate = {
  url: string;
  title: string;
  publisher: 'SparkToro';
  reliability_tier: 'low' | 'medium';
  limitation_note: string;
  snippet: string; // ≤ 500, không PII
};

export type RunSparktoroInput = {
  question_id: number;
};

export type RunSparktoroResult = {
  ok: true;
  run_id?: number;
  status?: string;
  note?: string;
  source_ids?: number[];
};

export type TalkwalkerSourceCandidate = {
  url: string;
  title: string;
  publisher: 'Talkwalker';
  reliability_tier: 'low' | 'medium';
  limitation_note: string;
  snippet: string; // ≤ 500, không PII
};

export type TalkwalkerNormalized = {
  results: Array<{
    url: string;
    title: string;
    snippet: string;
    published_at?: string;
    source_name?: string;
  }>;
};

export type RunTalkwalkerInput = {
  question_id: number;
};

export type RunTalkwalkerResult =
  | { ok: true; note: 'talkwalker_disabled' }
  | {
      ok: true;
      run_id: number;
      status: 'succeeded';
      source_ids: number[];
      note: 'talkwalker_stub' | 'talkwalker_live';
    };

export type RunQualtricsInput = {
  study_id: number;
  column_map?: Record<string, QualtricsColumnMapEntry>;
};

export type QualtricsColumnMapEntry = {
  question_code: string;
  unit: string;
  value_base: string;
  period_note?: string;
  geography?: string;
};

export const QUALTRICS_LIMITATION_NOTE =
  'Mẫu convenience Qualtrics — không MOE/95%. Không suy đại diện dân số.';

export const QUALTRICS_SURVEY_ID_RE = /^SV_[A-Za-z0-9]+$/;

export type RunQualtricsResult =
  | { ok: true; note: 'qualtrics_disabled' }
  | {
      ok: true;
      run_id: number;
      status: 'pending' | 'succeeded' | 'failed';
      evidence_ids?: number[];
    };

export type CreateSourceInput = {
  title: string;
  source_type?: string;
  publisher?: string | null;
  url?: string | null;
  published_at?: string | null;
  accessed_at?: string | null;
  geo?: string | null;
  license_note?: string | null;
  reliability_tier?: string;
  limitation_note?: string | null;
  question_id?: number | null;
  ai_generated?: boolean;
  keep?: boolean | null;
};

export type PatchSourceInput = {
  keep: boolean;
};

export type CreateEvidenceInput = {
  source_id?: number | null;
  study_id?: number | null;
  question_id?: number | null;
  locator?: string;
  excerpt?: string | null;
  value_num?: number | null;
  unit?: string | null;
  value_base?: string | null;
  period_note?: string | null;
  geography?: string | null;
  pii_class?: string | null;
};

export type PatchEvidenceInput = {
  locator?: string;
  excerpt?: string | null;
  value_num?: number | null;
  unit?: string | null;
  value_base?: string | null;
  period_note?: string | null;
  geography?: string | null;
  pii_class?: string | null;
  question_id?: number | null;
};

export type ResearchSourceRow = {
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
  limitation_note: string | null;
  snapshot_uri: string | null;
  content_hash: string | null;
  ai_generated: boolean;
  keep: boolean | null;
  triangulated: boolean;
  single_source_accepted: boolean;
  superseded_by: number | null;
  created_at: string;
  updated_at: string;
};

export type ResearchEvidenceRow = {
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

export type CreateInsightInput = {
  statement: string;
  observation?: string | null;
  interpretation?: string | null;
  implication?: string | null;
  recommendation?: string | null;
  audience?: string | null;
  confidence_rationale?: string | null;
  confidence_json?: ConfidenceRubric | ConfidenceJson;
  valid_from?: string | null;
  valid_to?: string | null;
  ai_generated?: boolean;
};

export type InsightCopilotInput = {
  evidence_ids: number[];
};

export type ReportCopilotInput = {
  insight_ids: number[];
};

export type CreateReportInput = {
  insight_ids: number[];
  methodology?: MethodologyBlock;
};

export type UpdateExecEnInput = {
  en: string;
};

export type UpdateReportEmbargoInput = {
  embargo_until?: string | null;
  expires_at?: string | null;
};

export type PublishPortalInput = {
  visible: boolean;
};

export type ResearchReportVersionRow = {
  id: number;
  report_id: number;
  version: number;
  content_snapshot: Record<string, unknown>;
  generated_by: string | null;
  content_hash: string;
  embargo_until: string | null;
  expires_at: string | null;
  portal_visible: boolean;
  published_by: string | null;
  published_at: string | null;
  created_at: string;
  /** Live at GET listReports; omitted on repo rows until service annotates. */
  has_stale_insights?: boolean;
};

export type PortalResearchReportCard = {
  version_id: number;
  version: number;
  as_of: string | null;
  expires_at: string | null;
  watermark: string;
  has_stale_insights: boolean;
};

export type PortalResearchReportDetail = PortalResearchReportCard & {
  exec: { vi: string; en: string | null };
  findings: unknown[];
  recs: unknown[];
  methodology: unknown;
  evidence_index: unknown[];
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

export type CreateWaveInput = {
  wave_no: number;
  label?: string | null;
  field_start?: string | null;
  field_end?: string | null;
  metric_json: { key: string; value: number | null }[];
};

export type WaveCompareRow = {
  key: string;
  prev: number | null;
  curr: number | null;
  delta: number | null;
};

export const DECISION_STATUSES = ['open', 'done', 'dropped'] as const;
export type DecisionStatus = (typeof DECISION_STATUSES)[number];

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

export type CreateDecisionInput = {
  insight_id: number;
  decision_text: string;
  owner_email: string;
  due_at?: string | null;
};

export type PatchDecisionInput = {
  status?: DecisionStatus;
  due_at?: string | null;
  owner_email?: string;
  decision_text?: string;
  insight_id?: number;
};

export type ResearchReportRow = {
  id: number;
  project_id: number;
  template: string;
  status: string;
  created_at: string;
  versions: ResearchReportVersionRow[];
};

export type CreateReportResult = {
  ok: true;
  report_id: number;
  version_id: number;
  version: number;
  content_snapshot: Record<string, unknown>;
  content_hash: string;
  portal_visible: boolean;
  published_by: string | null;
};

export type InsightCopilotResult = {
  ok: true;
  insight: ResearchInsightRow;
  run_id: number;
  rag_hits: CopilotRagHit[];
  rag_note?: CopilotRagNote;
};

export type ReportCopilotResult = {
  ok: true;
  report_id: number;
  version: number;
  content_snapshot: Record<string, unknown>;
  run_id: number;
};

export type PatchInsightInput = {
  statement?: string;
  observation?: string | null;
  interpretation?: string | null;
  implication?: string | null;
  recommendation?: string | null;
  audience?: string | null;
  confidence_rationale?: string | null;
  confidence_json?: ConfidenceRubric | ConfidenceJson;
  valid_from?: string | null;
  valid_to?: string | null;
};

export type SubmitReviewInput = {
  confidence_json?: ConfidenceRubric;
};

export type AttachInsightEvidenceInput = {
  evidence_ids: number[];
};

export type ApproveInsightInput = {
  target_status: string;
  comments?: string | null;
};

export type InsertReviewInput = {
  project_id: number;
  object_type: 'insight' | 'report' | 'source' | 'project';
  object_id: number;
  reviewer: string;
  role: string;
  decision: 'approve' | 'reject' | 'request_changes' | 'risk_accept';
  comments?: string | null;
};

export type ResearchInsightRow = {
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
  confidence_json: ConfidenceJson | ConfidenceRubric | null;
  ai_generated: boolean;
  created_by: string | null;
  valid_from: string | null;
  valid_to: string | null;
  is_stale: boolean;
  created_at: string;
  updated_at: string;
  evidence_ids: number[];
};

export const RAG_CORPUS_STATUSES = ['approved_client_facing', 'published'] as const;
export type RagCorpusStatus = (typeof RAG_CORPUS_STATUSES)[number];

export const RAG_EMBED_DIMS = 64;

export const OPENAI_EMBED_MODEL = 'text-embedding-3-small';
export const OPENAI_EMBED_DIMS = 256;
export const OPENAI_EMBED_URL = 'https://api.openai.com/v1/embeddings';

export type InsightEmbedResult = {
  embedding: number[];
  model: 'local-hash' | typeof OPENAI_EMBED_MODEL;
  dims: number;
};

export const RAG_SEARCH_BANNER =
  'Chỉ insight đã duyệt bản khách / published. Không tìm draft. Không tự tạo insight.';

export type RagEmbedInput = {
  insight_id: number;
  status: string;
  statement: string;
  observation: string | null;
};

export type RagHit = {
  insight_id: number;
  project_id: number;
  statement: string;
  status: RagCorpusStatus;
  score: number;
  theme_codes: string[];
  valid_to: string | null;
  is_stale: boolean;
};

export type RagSearchResult = {
  hits: RagHit[];
  note?: 'rag_disabled' | 'rag_embed_failed' | 'rag_skipped_pii';
};

export type ReembedCandidate = {
  insight_id: number;
  project_id: number;
  status: string;
  statement: string;
  observation: string | null;
  client_id?: string;
  embed_dims: number | null;
  embed_model: string | null;
};

export type RagReembedInput = {
  client_id?: string;
  limit?: number;
  dry_run?: boolean;
};

export type RagReembedPreviewResult = {
  ok: true;
  stale_count: number;
  target_dims: number;
  target_model: typeof OPENAI_EMBED_MODEL;
};

export type RagReembedStartResult = {
  ok: true;
  run_id?: number;
  status: 'pending' | 'succeeded' | 'failed' | 'noop';
  note?: 'jobs_disabled' | 'rag_reembed_disabled' | 'rag_disabled';
  processed?: number;
  skipped_pii?: number;
  failed?: number;
  remaining?: number;
};

export const PORTAL_RAG_CORPUS_STATUSES = ['published'] as const;

export const PORTAL_RAG_BANNER =
  'Chỉ insight đã published cùng khách. Không tìm draft. Không tạo insight.';

export type PortalRagSearchInput = {
  q?: string;
  theme_code?: string;
  limit?: string | number;
  client_id?: string;
  stale_only?: string | boolean;
};

export type PortalReportsListInput = {
  stale_only?: string | boolean;
};

export type PortalThemeQuarterAnalyticsPayload = {
  ok: true;
  year: number;
  client_id: string;
  corpus_statuses: readonly ['published'];
  rows: ThemeQuarterRow[];
};

export type PortalResearchHealth = {
  ok: true;
  enabled: true;
  rag_enabled: boolean;
  rag_openai_embed_enabled: boolean;
  rag_embed_model: 'openai' | 'local';
  rag_pgvector_enabled: boolean;
  rag_pgvector_ready: boolean;
};

export const RAG_COPILOT_HIT_LIMIT = 5;

export const RAG_COPILOT_BANNER =
  'Copilot có thể tham chiếu insight đã duyệt cùng khách. Bản nháp — không tự duyệt, không tự công bố.';

export type CopilotRagNote = 'rag_disabled' | 'rag_skipped_pii' | 'rag_empty';

export type CopilotRagHit = {
  insight_id: number;
  statement: string;
  status: RagCorpusStatus;
  score: number;
  theme_codes: string[];
};

export type RagEmbeddingRow = RagEmbedInput & {
  project_id: number;
  embedding: number[];
  theme_codes: string[];
  theme_synonyms?: string[];
  client_id?: string;
  valid_to?: string | null;
};

export type UpsertInsightEmbeddingInput = {
  insight_id: number;
  project_id: number;
  embedding: number[];
  embed_text: string;
  embed_model: string;
  embed_dims: number;
  write_vec?: boolean;
};

export type ListEmbeddingsFilters = {
  client_id?: string;
  allowedClientIds?: string[];
  theme_code?: string;
};

export type SearchInsightsInput = {
  q?: string;
  theme_code?: string;
  client_id?: string;
  limit?: string | number;
  stale_only?: string | boolean;
};

export type TaxonomyTheme = {
  id: number;
  theme_code: string;
  label_vi: string;
  synonyms: string[];
  active: boolean;
};

export type CreateTaxonomyInput = {
  theme_code: string;
  label_vi: string;
  synonyms?: string[];
};

export type PatchTaxonomyInput = {
  label_vi?: string;
  synonyms?: string[];
  active?: boolean;
};

export type AttachInsightThemeInput = {
  taxonomy_id: number;
};

export const SEED_TAXONOMY: ReadonlyArray<{ theme_code: string; label_vi: string; synonyms: string[] }> = [
  { theme_code: 'PRICE', label_vi: 'Giá', synonyms: ['pricing', 'giá bán'] },
  { theme_code: 'CHANNEL', label_vi: 'Kênh', synonyms: ['phân phối'] },
  { theme_code: 'COMPETITOR', label_vi: 'Đối thủ', synonyms: ['cạnh tranh'] },
  { theme_code: 'TREND', label_vi: 'Xu hướng', synonyms: ['emerging'] },
  { theme_code: 'SEGMENT', label_vi: 'Phân khúc', synonyms: ['đối tượng'] },
  { theme_code: 'RISK', label_vi: 'Rủi ro', synonyms: ['limitation'] },
  { theme_code: 'MESSAGE', label_vi: 'Thông điệp', synonyms: ['claim'] },
  { theme_code: 'GEO', label_vi: 'Địa bàn', synonyms: ['khu vực'] },
];
