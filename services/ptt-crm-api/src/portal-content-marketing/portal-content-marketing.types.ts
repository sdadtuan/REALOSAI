export type CmktPortalSummaryItem = {
  id: number;
  title: string;
  channel: string;
  format: string;
  status: string;
  updated_at: string;
};

export type CmktPortalContentSummary = {
  ok: boolean;
  enabled: boolean;
  lifecycle_id: number;
  service_slug: string;
  items_by_status: Record<string, number>;
  pending_client_count: number;
  published_mtd: number;
  pending_items: CmktPortalSummaryItem[];
  staff_content_url: string;
};
