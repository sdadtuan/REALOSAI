import type { B2bSlaState } from './b2b-lead-list.util';
import { DEFAULT_SLA, slaBand } from './b2b-sla.util';

export type B2bNbaAction = 'call' | 'note' | 'meet';

export interface B2bNbaResult {
  action: B2bNbaAction;
  label_vi: string;
  due_in_seconds: number;
}

export function resolveB2bNba(input: {
  score: number | null;
  slaState: B2bSlaState;
  elapsedMin: number;
  hasCall: boolean;
  hasNote: boolean;
  hasMeeting: boolean;
  inHours: boolean;
}): B2bNbaResult | null {
  if (!input.inHours) return null;

  const band = slaBand(input.score);
  const cfg = DEFAULT_SLA[band];
  const dueBeforeHopSec = Math.max(0, Math.round((cfg.hopMin - input.elapsedMin) * 60));

  if (
    !input.hasCall &&
    (input.slaState === 'warning' || input.slaState === 'breach')
  ) {
    return {
      action: 'call',
      label_vi: 'Gọi ngay — first-touch SLA',
      due_in_seconds: dueBeforeHopSec,
    };
  }

  if (!input.hasNote) {
    return {
      action: 'note',
      label_vi: 'Ghi chú tương tác sau liên hệ',
      due_in_seconds: dueBeforeHopSec || cfg.warnMin * 60,
    };
  }

  if (!input.hasMeeting) {
    return {
      action: 'meet',
      label_vi: 'Đặt lịch hẹn với khách',
      due_in_seconds: 24 * 3600,
    };
  }

  return null;
}
