import { envFlagOn } from '../bds/bds.flags';

export function isStaffChatEnabled(): boolean {
  return envFlagOn(process.env.PTT_STAFF_CHAT);
}
