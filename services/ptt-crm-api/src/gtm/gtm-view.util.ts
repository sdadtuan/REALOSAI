import type { GtmDemoRequestRow, GtmDemoRequestView } from './gtm.types';
import { formatSlaDeadlineLocal, gtmSlaTone } from './gtm-sla.util';

export function toGtmDemoRequestView(row: GtmDemoRequestRow, now = new Date()): GtmDemoRequestView {
  const created = new Date(row.created_at);
  const sla = formatSlaDeadlineLocal(created, row.market_country);
  return {
    ...row,
    sla_tone: gtmSlaTone(created, now, row.status),
    sla_deadline_local: row.status === 'new' ? sla.label : null,
    sla_timezone_label: row.status === 'new' ? sla.timezone_label : null,
  };
}
