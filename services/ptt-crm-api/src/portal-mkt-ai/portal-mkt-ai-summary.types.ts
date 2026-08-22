export interface MktAiPortalSummary {
  ok: boolean;
  enabled: boolean;
  lifecycle_id: number;
  service_slug: string;
  brand_name: string | null;
  quality_score: number | null;
  playbook_label: string | null;
  strategy_excerpt: string;
  campaign_count: number;
  last_updated_at: string;
  staff_planner_url: string;
}

export interface MktAiPortalLinkedLifecycle {
  ok: boolean;
  enabled: boolean;
  lifecycle_id: number | null;
  service_slug: string | null;
  stage: string | null;
}
