import { randomBytes } from 'crypto';
import type { GtmStatus } from './gtm-status.util';

const SANDBOX_GRANT_STATUSES = new Set<GtmStatus>(['qualified', 'demo_booked']);
const OTP_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
const SANDBOX_TTL_DAYS = 14;

export function sandboxUsername(requestId: string): string {
  const compact = requestId.replace(/-/g, '');
  const suffix = compact.length > 8 ? compact.slice(0, 8) : compact;
  return `demo_${suffix}`;
}

export function sandboxTenant(industry: string): string {
  return `sandbox_${industry}`;
}

export function sandboxExpiresAt(from: Date): Date {
  const expires = new Date(from);
  expires.setUTCDate(expires.getUTCDate() + SANDBOX_TTL_DAYS);
  return expires;
}

export function canGrantSandbox(status: string): boolean {
  return SANDBOX_GRANT_STATUSES.has(status as GtmStatus);
}

export function oneTimePassword(length = 16): string {
  const bytes = randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += OTP_ALPHABET[bytes[i] % OTP_ALPHABET.length];
  }
  return out;
}

export function formatSandboxExpiryVi(date: Date): string {
  return date.toLocaleDateString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}
