import type { HrStaffLifecycleStage } from './hr-staff-p5.types';

const MS_DAY = 86_400_000;

export const HR_LIFECYCLE_STAGES: HrStaffLifecycleStage[] = [
  'offer',
  'onboard_docs',
  'probation',
  'official',
  'transfer',
  'notice',
  'offboard_hold',
  'archived',
];

export function lifecycleStageLabel(stage: string): string {
  const map: Record<string, string> = {
    offer: 'Offer',
    onboard_docs: 'Onboard giấy tờ',
    probation: 'Thử việc',
    official: 'Chính thức',
    transfer: 'Chuyển bộ phận',
    notice: 'Thông báo nghỉ',
    offboard_hold: 'Offboard',
    archived: 'Lưu trữ',
  };
  return map[stage] ?? stage;
}

export function maskDependentCccd(value: string | null | undefined, canViewPii: boolean): string {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  if (canViewPii) return raw;
  if (raw.length <= 3) return '•••';
  return `•••• ${raw.slice(-3)}`;
}

export function bodyContainsDependentPii(body: Record<string, unknown>): boolean {
  return body.cccd !== undefined;
}

export function isExpiringDate(dateStr: string | null | undefined, withinDays = 30): boolean {
  if (!dateStr) return false;
  const exp = new Date(`${String(dateStr).slice(0, 10)}T00:00:00Z`).getTime();
  const now = Date.now();
  return exp - now <= withinDays * MS_DAY && exp >= now;
}

export function emptyLifecycleRow(staffId: number): import('./hr-staff-p5.types').HrStaffLifecycleRow {
  return {
    staff_id: staffId,
    stage: 'offer',
    stage_changed_on: null,
    notes: '',
    created_at: '',
    updated_at: '',
  };
}
