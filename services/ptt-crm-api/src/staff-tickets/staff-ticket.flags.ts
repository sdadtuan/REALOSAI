import { envFlagOn } from '../bds/bds.flags';

export function isStaffTicketsEnabled(): boolean {
  return envFlagOn(process.env.PTT_STAFF_TICKETS);
}

export function isStaffTicketsNotifyEnabled(): boolean {
  return envFlagOn(process.env.PTT_STAFF_TICKETS_NOTIFY);
}

export function isStaffTicketsLaunchOpsEnabled(): boolean {
  return envFlagOn(process.env.PTT_STAFF_TICKETS_LAUNCH_OPS);
}
