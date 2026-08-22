export const LEAD_STATUS_LABELS: Record<string, string> = {
  moi: 'Mới',
  da_lien_he: 'Đã liên hệ',
  dang_tu_van: 'Đang tư vấn',
  hen_gap: 'Hẹn gặp',
  bao_gia: 'Báo giá',
  dam_phan: 'Đàm phán',
  chot: 'Chốt',
  post_sale: 'Post-sale',
  won: 'Won (HĐ ký)',
  proposal: 'Proposal',
  lost: 'Lost',
  pending_cleanup: 'Chờ dọn',
};

export function leadStatusLabel(status: string | null | undefined): string {
  if (!status) return '—';
  return LEAD_STATUS_LABELS[status] ?? status.replace(/_/g, ' ');
}

export type LeadStatusTone = 'new' | 'active' | 'won' | 'lost' | 'neutral';

export function leadStatusTone(status: string | null | undefined): LeadStatusTone {
  if (!status) return 'neutral';
  if (status === 'moi') return 'new';
  if (status === 'chot' || status === 'post_sale' || status === 'won') return 'won';
  if (status === 'lost' || status === 'pending_cleanup') return 'lost';
  if (['da_lien_he', 'dang_tu_van', 'hen_gap', 'bao_gia', 'dam_phan', 'proposal'].includes(status)) return 'active';
  return 'neutral';
}
