import { hasCap, type StoredStaffUser } from '@/lib/auth';

export function shouldShowVideoSopNav(user: StoredStaffUser | null): boolean {
  if (hasCap(user, 'crm_vd.project', 'view')) return true;
  return process.env.NEXT_PUBLIC_CMKT_VIDEO_CINEMATIC === '1' && hasCap(user, 'crm_content', 'view');
}
