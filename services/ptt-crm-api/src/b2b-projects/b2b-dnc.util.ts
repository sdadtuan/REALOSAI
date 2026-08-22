import { createHash } from 'crypto';
import { normalizePhone } from '../leads/ingest/lead-contact.util';

export function isDncBlocked(phone: string, dncList: string[]): boolean {
  const norm = normalizePhone(phone);
  if (!norm) return false;
  return dncList.some((entry) => normalizePhone(entry) === norm);
}

export function hashPhoneForCapi(raw: string | null | undefined): string | null {
  const norm = normalizePhone(raw);
  if (!norm) return null;
  let digits = norm.replace(/\D/g, '');
  if (digits.startsWith('0')) {
    digits = `84${digits.slice(1)}`;
  } else if (!digits.startsWith('84')) {
    digits = `84${digits.replace(/^0+/, '')}`;
  }
  if (digits.length < 10) return null;
  return createHash('sha256').update(digits).digest('hex');
}
