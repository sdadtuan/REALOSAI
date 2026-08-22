import { DatabaseSync } from 'node:sqlite';
import { tableExists } from './finance-metrics.util';

export function sumReceivedRevenueForRange(db: DatabaseSync, start: string, end: string): number {
  if (!tableExists(db, 'crm_svc_payments')) return 0;
  const row = db
    .prepare(
      `
      SELECT COALESCE(SUM(amount_vnd), 0) AS v
      FROM crm_svc_payments
      WHERE status = 'received'
        AND received_on >= ?
        AND received_on <= ?
    `,
    )
    .get(start, end) as Record<string, unknown> | undefined;
  return Number(row?.v ?? 0);
}
