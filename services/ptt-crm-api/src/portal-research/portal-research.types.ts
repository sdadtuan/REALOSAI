import type {
  PortalResearchReportCard,
  PortalResearchReportDetail,
} from '../market-research/market-research.types';

export type { PortalResearchReportCard, PortalResearchReportDetail };

export type PortalCjLevelShare = {
  label: string;
  count: number;
  share_pct: number;
};

export type PortalCjAttributeSummary = {
  name: string;
  levels: PortalCjLevelShare[];
  top_level: string | null;
};

export type PortalCjRecommendation = {
  levels: Array<{ attribute: string; level: string; share_pct: number }>;
};

export type PortalCjSummary = {
  n: number;
  n_choices: number;
  attributes: PortalCjAttributeSummary[];
  recommendation: PortalCjRecommendation;
  limitation_note: string;
  statistical_inference: false;
};

export type PortalResearchVersionRecord = {
  id: number;
  report_id: number;
  version: number;
  content_snapshot: Record<string, unknown>;
  generated_by: string | null;
  content_hash: string;
  embargo_until: string | null;
  expires_at: string | null;
  portal_visible: boolean;
  created_at: string;
  client_id: string;
};
