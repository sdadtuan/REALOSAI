import { envFlagOn } from '../bds/bds.flags';

export function isStaffTicketsEnabled(): boolean {
  return envFlagOn(process.env.PTT_STAFF_TICKETS);
}
