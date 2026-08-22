import { DEFAULT_SLA, isWithinBusinessHours, slaBand } from './b2b-sla.util';

export type B2bAiBand = 'hot' | 'warm' | 'cold';
export type B2bSlaState = 'na' | 'ok' | 'warning' | 'breach';

export function computeB2bAiBand(score: number | null): B2bAiBand {
  return slaBand(score);
}

export function computeB2bSlaState(input: {
  score: number | null;
  elapsedMin: number;
  hasCallActivity: boolean;
  answered: boolean;
  inHours: boolean;
  sla?: typeof DEFAULT_SLA;
}): B2bSlaState {
  if (!input.inHours || input.answered || input.hasCallActivity) return 'na';
  const cfg = (input.sla ?? DEFAULT_SLA)[slaBand(input.score)];
  if (input.elapsedMin >= cfg.hopMin) return 'breach';
  if (input.elapsedMin >= cfg.warnMin) return 'warning';
  return 'ok';
}

export function isB2bLeadInCall(callState: string | null | undefined): boolean {
  return callState === 'ringing' || callState === 'answered';
}

export function defaultB2bBusinessHours() {
  return { tz: 'Asia/Ho_Chi_Minh', days: [1, 2, 3, 4, 5, 6], start: '08:00', end: '18:00' };
}

export function isB2bInHoursNow(now = new Date()): boolean {
  return isWithinBusinessHours(defaultB2bBusinessHours(), now);
}
