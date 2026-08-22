import type { LeadMeetingPrepStage } from './lead-meeting-prep.types';

export const PREP_STAGE_LABEL_VI: Record<LeadMeetingPrepStage, string> = {
  m1_first_strike: 'M1 · Vũ khí cuộc gọi đầu',
  m2_qualify_win: 'M2 · Brief sau BANT — đẩy handoff',
  m3_pre_close: 'M3 · Sẵn sàng chốt — Deal Room',
  m4_learn: 'M4 · Win loop — học từ chốt/lost',
};

export function resolveModeForStage(
  prepStage: LeadMeetingPrepStage,
  opts: { hasCollect?: boolean; collectFresh?: boolean } = {},
): 'full' | 'strategize_arm' | 'refresh' | 'learn' {
  if (prepStage === 'm4_learn') return 'learn';
  if (prepStage === 'm1_first_strike') return 'full';
  if (prepStage === 'm3_pre_close') return 'strategize_arm';
  if (opts.hasCollect && opts.collectFresh) return 'strategize_arm';
  if (opts.hasCollect) return 'refresh';
  return 'full';
}

export function buildLmpIdempotencyKey(
  leadId: number,
  prepStage: LeadMeetingPrepStage,
  force: boolean,
): string {
  if (force) {
    return `lead_meeting_prep:lead:${leadId}:stage:${prepStage}:manual:${Date.now()}`;
  }
  return `lead_meeting_prep:lead:${leadId}:stage:${prepStage}`;
}

export const LMP_M2_COLLECT_REUSE_HOURS = 24;
