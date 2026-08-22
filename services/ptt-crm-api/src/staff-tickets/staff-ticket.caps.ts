import type { StaffSectionCap } from '../staff-auth/staff-auth.types';

export const STAFF_TICKET_CAP_CATALOG: ReadonlyArray<StaffSectionCap> = [
  { section: 'staff_tickets', action: 'view' },
  { section: 'staff_tickets', action: 'create' },
  { section: 'staff_tickets', action: 'assign' },
  { section: 'staff_tickets', action: 'close' },
  { section: 'staff_tickets', action: 'export' },
];
