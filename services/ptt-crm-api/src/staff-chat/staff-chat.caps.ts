import type { StaffSectionCap } from '../staff-auth/staff-auth.types';

export const STAFF_CHAT_CAP_CATALOG: ReadonlyArray<StaffSectionCap> = [
  { section: 'staff_chat', action: 'view' },
  { section: 'staff_chat', action: 'post' },
  { section: 'staff_chat', action: 'moderate' },
  { section: 'staff_chat', action: 'export' },
];
