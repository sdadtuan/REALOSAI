export const CONSULT_PROPOSAL_SLA_HOURS = 48;
export const CONSULT_PROPOSAL_WARN_HOURS_BEFORE = 12;

export type PresalesConsultSlaState = 'na' | 'ok' | 'warning' | 'breach';

export interface PresalesConsultProposalSla {
  tier: 'consult_proposal_48h';
  sla_state: PresalesConsultSlaState;
  started_at: string | null;
  deadline_at: string | null;
  hours_elapsed: number | null;
  hours_remaining: number | null;
  minutes_remaining: number | null;
  message: string;
  reminder_cta: string;
}

function parseTimestamp(raw: string | null | undefined): Date | null {
  const text = String(raw ?? '').trim();
  if (!text) return null;
  const normalized = text.includes('T') ? text : text.replace(' ', 'T');
  const d = new Date(normalized.endsWith('Z') ? normalized : `${normalized}Z`);
  if (Number.isNaN(d.getTime())) {
    const fallback = new Date(text);
    return Number.isNaN(fallback.getTime()) ? null : fallback;
  }
  return d;
}

function formatHoursRemaining(hours: number): string {
  if (hours <= 0) return '0h';
  if (hours >= 48) return `${Math.round(hours)}h`;
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return m > 0 ? `${h}h${m}p` : `${h}h`;
}

export function resolveConsultStartedAt(input: {
  consultEnteredAt: string | null | undefined;
  stageEnteredAt: string | null | undefined;
}): string | null {
  const consult = String(input.consultEnteredAt ?? '').trim();
  if (consult) return consult;
  return String(input.stageEnteredAt ?? '').trim() || null;
}

export function buildPresalesConsultProposalSla(input: {
  presalesStage: string;
  consultEnteredAt: string | null | undefined;
  stageEnteredAt: string | null | undefined;
  now?: Date;
}): PresalesConsultProposalSla {
  const base: PresalesConsultProposalSla = {
    tier: 'consult_proposal_48h',
    sla_state: 'na',
    started_at: null,
    deadline_at: null,
    hours_elapsed: null,
    hours_remaining: null,
    minutes_remaining: null,
    message: 'SLA Consult → Báo giá áp dụng khi đang ở giai đoạn Tư vấn.',
    reminder_cta: 'Tạo nhắc SLA Consult → Báo giá',
  };

  if (String(input.presalesStage ?? '').trim() !== 'consult') {
    return base;
  }

  const startedAt = resolveConsultStartedAt(input);
  const started = parseTimestamp(startedAt);
  if (!started) {
    return {
      ...base,
      message: 'Chưa ghi thời điểm vào Consult — SLA 48h bắt đầu khi chuyển → Tư vấn.',
    };
  }

  const now = input.now ?? new Date();
  const deadline = new Date(started.getTime() + CONSULT_PROPOSAL_SLA_HOURS * 3_600_000);
  const elapsedMs = now.getTime() - started.getTime();
  const remainingMs = deadline.getTime() - now.getTime();
  const hoursElapsed = Math.max(0, elapsedMs / 3_600_000);
  const hoursRemaining = remainingMs / 3_600_000;
  const minutesRemaining = Math.round(remainingMs / 60_000);

  let slaState: PresalesConsultSlaState = 'ok';
  let message = `Còn ${formatHoursRemaining(hoursRemaining)} để chuyển → Báo giá (SLA ≤48h sau Consult).`;

  if (hoursRemaining <= 0) {
    slaState = 'breach';
    message = `Quá hạn SLA 48h (${formatHoursRemaining(hoursElapsed)} kể từ vào Consult) — chuyển → Báo giá ngay.`;
  } else if (hoursRemaining <= CONSULT_PROPOSAL_WARN_HOURS_BEFORE) {
    slaState = 'warning';
    message = `Sắp hết SLA 48h — còn ${formatHoursRemaining(hoursRemaining)} để chuyển → Báo giá.`;
  }

  return {
    tier: 'consult_proposal_48h',
    sla_state: slaState,
    started_at: startedAt,
    deadline_at: deadline.toISOString(),
    hours_elapsed: Math.round(hoursElapsed * 10) / 10,
    hours_remaining: Math.round(Math.max(0, hoursRemaining) * 10) / 10,
    minutes_remaining: minutesRemaining,
    message,
    reminder_cta: 'Tạo nhắc SLA Consult → Báo giá',
  };
}

export interface PresalesConsultSlaSummary {
  active_consult: number;
  sla_ok: number;
  sla_warning: number;
  sla_breach: number;
  consult_to_proposal_48h_pct: number;
  consult_to_proposal_48h_num: number;
  consult_to_proposal_48h_denom: number;
}

export function hoursBetween(startRaw: string | null, endRaw: string | null): number | null {
  const start = parseTimestamp(startRaw);
  const end = parseTimestamp(endRaw);
  if (!start || !end) return null;
  return (end.getTime() - start.getTime()) / 3_600_000;
}

export function isConsultToProposalWithin48h(
  consultEnteredAt: string | null,
  proposalEnteredAt: string | null,
): boolean {
  const hrs = hoursBetween(consultEnteredAt, proposalEnteredAt);
  if (hrs == null || hrs < 0) return false;
  return hrs <= CONSULT_PROPOSAL_SLA_HOURS;
}
