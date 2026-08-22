import { redactPortalText } from '../portal-mkt-ai/portal-mkt-ai-summary.util';
import type { CmktItemRow } from '../content-marketing/content-marketing.types';
import type { CmktPortalSummaryItem } from './portal-content-marketing.types';

export function buildStaffContentOsUrl(opsWebBase: string, lifecycleId: number): string {
  const base = opsWebBase.replace(/\/$/, '');
  return `${base}/crm/service-delivery/${lifecycleId}?tab=content-os`;
}

export function toPortalSummaryItem(row: CmktItemRow): CmktPortalSummaryItem {
  return {
    id: row.id,
    title: redactPortalText(row.title),
    channel: row.channel,
    format: row.format,
    status: row.status,
    updated_at: row.updated_at,
  };
}
