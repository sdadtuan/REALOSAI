import { B2B_MAX_HOPS } from './b2b-projects.constants';

export type SlaBand = 'hot' | 'warm' | 'cold';
export type SlaAction = 'none' | 'ai_call' | 'hop' | 'gdkd_queue';

export const DEFAULT_SLA = {
  hot: { warnMin: 3, hopMin: 5 },
  warm: { warnMin: 10, hopMin: 15 },
  cold: { warnMin: 25, hopMin: 30 },
  maxHops: B2B_MAX_HOPS,
};

export function slaBand(score: number | null): SlaBand {
  if (score != null && score >= 70) return 'hot';
  if (score != null && score >= 40) return 'warm';
  return 'cold';
}

export function isWithinBusinessHours(
  hours: { tz: string; days: number[]; start: string; end: string },
  now: Date,
): boolean {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: hours.tz || 'UTC',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const wd = parts.find((p) => p.type === 'weekday')?.value;
  const map: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 0 };
  const day = map[wd ?? ''] ?? -1;
  if (!hours.days.includes(day)) return false;
  const hour = parts.find((p) => p.type === 'hour')?.value ?? '00';
  const minute = parts.find((p) => p.type === 'minute')?.value ?? '00';
  const cur = `${hour}:${minute}`;
  return cur >= hours.start && cur < hours.end;
}

export function resolveSlaAction(input: {
  score: number | null;
  elapsedMin: number;
  hopCount: number;
  hasCallActivity: boolean;
  answered: boolean;
  inHours: boolean;
  sla?: typeof DEFAULT_SLA;
}): SlaAction {
  if (!input.inHours || input.hasCallActivity || input.answered) return 'none';
  const sla = input.sla ?? DEFAULT_SLA;
  const band = slaBand(input.score);
  const cfg = sla[band];
  if (input.elapsedMin >= cfg.hopMin) {
    return input.hopCount >= sla.maxHops ? 'gdkd_queue' : 'hop';
  }
  if (input.elapsedMin >= cfg.warnMin) return 'ai_call';
  return 'none';
}

export function shouldStartAiCall(input: {
  action: SlaAction;
  hasStaffDialed: boolean;
  alreadyAiCalled: boolean;
  aiCallEnabled: boolean;
  dncBlocked?: boolean;
}): boolean {
  if (input.dncBlocked) return false;
  return (
    input.aiCallEnabled &&
    input.action === 'ai_call' &&
    !input.hasStaffDialed &&
    !input.alreadyAiCalled
  );
}
