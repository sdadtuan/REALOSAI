import { createHash } from 'node:crypto';

export function hashGtmIp(ip: string, salt: string): string {
  if (!salt) {
    throw new Error('GTM_IP_SALT missing');
  }
  return createHash('sha256').update(ip + salt).digest('hex');
}
