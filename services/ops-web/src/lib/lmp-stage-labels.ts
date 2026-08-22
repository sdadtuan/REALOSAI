import type { PrepStage } from '@/app/crm/leads/meeting-prep/lead-meeting-prep.types';

export const PREP_STAGE_LABEL_VI: Record<PrepStage, string> = {
  m1_first_strike: 'M1 · Vũ khí cuộc gọi đầu',
  m2_qualify_win: 'M2 · Brief sau BANT — đẩy handoff',
  m3_pre_close: 'M3 · Sẵn sàng chốt — Deal Room',
  m4_learn: 'M4 · Win loop — học từ chốt/lost',
};

export function prepStageSubtitle(prepStage: string | null | undefined): string {
  const key = prepStage as PrepStage;
  return PREP_STAGE_LABEL_VI[key] ?? String(prepStage ?? '—');
}
