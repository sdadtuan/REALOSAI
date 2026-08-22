import { ForbiddenException } from '@nestjs/common';
import type { StaffSectionCap } from '../staff-auth/staff-auth.types';
import { isHandoffActive, type PresalesHandoffStatus } from './presales-solution-handoff.util';

export const PRESALES_SOLUTION_SECTION = 'crm_presales_solution';

export type PresalesSolutionCapAction = 'view' | 'edit' | 'claim' | 'release';

export function hasPresalesSolutionCap(
  caps: StaffSectionCap[],
  action: PresalesSolutionCapAction,
): boolean {
  return caps.some((c) => c.section === PRESALES_SOLUTION_SECTION && c.action === action);
}

export function hasPresalesSolutionEditAccess(
  caps: StaffSectionCap[],
  opts: { gdkdAssign?: boolean } = {},
): boolean {
  if (hasPresalesSolutionCap(caps, 'edit')) return true;
  if (opts.gdkdAssign) return true;
  return false;
}

export function assertPresalesSolutionCap(
  caps: StaffSectionCap[],
  action: PresalesSolutionCapAction,
  opts: { gdkdAssign?: boolean; message?: string } = {},
): void {
  if (hasPresalesSolutionCap(caps, action)) return;
  if (opts.gdkdAssign && (action === 'claim' || action === 'release' || action === 'edit')) {
    return;
  }
  throw new ForbiddenException({
    error: 'missing_cap',
    section: PRESALES_SOLUTION_SECTION,
    action,
    message:
      opts.message ??
      (action === 'edit'
        ? 'Giai đoạn Solution/MKT — bạn chỉ theo dõi. Liên hệ Solution hoặc mở /crm/solution/queue.'
        : `Thiếu quyền ${PRESALES_SOLUTION_SECTION}.${action}`),
  });
}

/** Block AM consult edits while case is with Solution (pending / with_solution). */
export function assertCanMutatePresalesConsult(
  caps: StaffSectionCap[],
  handoffStatus: PresalesHandoffStatus,
  presalesStage: string,
  opts: { gdkdAssign?: boolean } = {},
): void {
  if (presalesStage !== 'consult') return;
  if (!isHandoffActive(handoffStatus) && handoffStatus === '') return;
  if (isHandoffActive(handoffStatus) || handoffStatus === 'released') {
    if (hasPresalesSolutionEditAccess(caps, opts)) return;
    throw new ForbiddenException({
      error: 'solution_read_only',
      message:
        'Giai đoạn Solution/MKT — AM không chỉnh Consult/R5. Solution hoàn tất rồi Trả Sales — Báo giá.',
    });
  }
}

export function assertCanAdvanceConsultToProposal(
  caps: StaffSectionCap[],
  handoffStatus: PresalesHandoffStatus,
  opts: { gdkdAssign?: boolean } = {},
): void {
  if (!isHandoffActive(handoffStatus) && handoffStatus === '') return;
  if (handoffStatus === 'released') return;
  if (hasPresalesSolutionCap(caps, 'release') || opts.gdkdAssign) return;
  throw new ForbiddenException({
    error: 'solution_release_required',
    message:
      'Không thể Chuyển → Báo giá — Solution cần Trả Sales sau Consult + R5. AM theo dõi tại banner Solution.',
  });
}
