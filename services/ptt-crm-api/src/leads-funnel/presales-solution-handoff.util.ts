export const PRESALES_HANDOFF_STATUSES = ['', 'pending', 'with_solution', 'released'] as const;
export type PresalesHandoffStatus = (typeof PRESALES_HANDOFF_STATUSES)[number];

export function normalizeHandoffStatus(raw: unknown): PresalesHandoffStatus {
  const s = String(raw ?? '').trim();
  if (s === 'pending' || s === 'with_solution' || s === 'released') return s;
  return '';
}

export function isHandoffActive(status: PresalesHandoffStatus): boolean {
  return status === 'pending' || status === 'with_solution';
}

/** Block direct advance consult→proposal until Solution releases (legacy empty = allowed). */
export function blocksDirectProposalAdvance(status: PresalesHandoffStatus): boolean {
  return status === 'pending' || status === 'with_solution';
}

export function handoffBadgeLabel(
  status: PresalesHandoffStatus,
  ownerName?: string | null,
): string | null {
  if (status === 'pending') return 'Đang chờ Solution/MKT nhận case';
  if (status === 'with_solution') {
    const who = String(ownerName ?? '').trim();
    return who ? `Đang Solution/MKT — ${who}` : 'Đang Solution/MKT xử lý';
  }
  return null;
}
