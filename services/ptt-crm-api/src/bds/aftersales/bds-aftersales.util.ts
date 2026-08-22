import {
  HANDOVER_CHECK_CODES,
  type CheckInput,
  type HandoverGateOpts,
  type TitleStatus,
} from './bds-aftersales.types';

export { HANDOVER_CHECK_CODES };

const TITLE_NEXT: Record<TitleStatus, TitleStatus | null> = {
  not_started: 'submitted',
  submitted: 'issued',
  issued: 'handed_to_buyer',
  handed_to_buyer: null,
};

const APPOINTMENT_DUE_MS = 15 * 24 * 60 * 60 * 1000;

export function canHandover(checks: CheckInput[], opts: HandoverGateOpts): boolean {
  if (opts.waive) {
    return Boolean(opts.hasApproveCap) && String(opts.waiveReason ?? '').trim().length >= 3;
  }
  const passed = new Set(
    checks.filter((c) => c.status === 'pass').map((c) => c.item_code),
  );
  return HANDOVER_CHECK_CODES.every((code) => passed.has(code));
}

export function canAdvanceTitle(from: string, to: string): boolean {
  return TITLE_NEXT[from as TitleStatus] === to;
}

export function appointmentDue(scheduledAt: Date | null, now = new Date()): boolean {
  if (!scheduledAt) return true;
  return scheduledAt.getTime() - now.getTime() <= APPOINTMENT_DUE_MS;
}

export function isHandoverCheckCode(raw: string): raw is (typeof HANDOVER_CHECK_CODES)[number] {
  return (HANDOVER_CHECK_CODES as readonly string[]).includes(raw);
}

const CHECK_STATUSES = new Set(['pending', 'pass', 'fail']);
const TICKET_KINDS = new Set(['defect', 'title', 'other']);
const TICKET_STATUSES = new Set(['open', 'in_progress', 'done', 'cancelled']);

export function isCheckStatus(raw: string): raw is 'pending' | 'pass' | 'fail' {
  return CHECK_STATUSES.has(raw);
}

export function isTicketKind(raw: string): raw is 'defect' | 'title' | 'other' {
  return TICKET_KINDS.has(raw);
}

export function isTicketStatus(raw: string): raw is 'open' | 'in_progress' | 'done' | 'cancelled' {
  return TICKET_STATUSES.has(raw);
}
