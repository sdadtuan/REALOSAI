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

export const APPROVED_INTERNAL_PLUS: InsightStatus[] = [
  'approved_internal',
  'approved_client_facing',
  'published',
];

export type InsightGateCode =
  | 'missing_verified_evidence'
  | 'missing_confidence_rationale'
  | 'missing_confidence_rubric'
  | 'forbidden_confidence_wording';

export type ResearchJobType =
  | 'desk_tavily'
  | 'deep_research'
  | 'research_triangulate'
  | 'research_pulse'
  | 'insight_draft'
  | 'report_draft'
  | 'pii_scan'
  | 'whisper_ingest'
  | 'sparktoro'
  | 'qualtrics'
  | 'rag_reembed';

export const MAX_TAVILY_CREDITS_PER_RESEARCH = 12;
