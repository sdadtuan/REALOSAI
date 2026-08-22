import { createHash } from 'crypto';

export interface B2bAlertInboxHashRow {
  id: string;
  severity: string;
}

export function hashB2bAlertInbox(rows: B2bAlertInboxHashRow[]): string {
  const payload = rows.map((r) => `${r.id}:${r.severity}`).join('|');
  return createHash('sha256').update(payload).digest('hex').slice(0, 16);
}
