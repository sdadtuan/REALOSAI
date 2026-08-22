/** Phone/email normalization aligned with crm_lead_store.py (BR-CRM-01). */

const PHONE_DIGITS_RE = /[^0-9]/g;

export function normalizePhone(raw: string | null | undefined): string {
  let digits = String(raw ?? '').replace(PHONE_DIGITS_RE, '');
  if (digits.startsWith('84') && digits.length >= 11) {
    digits = `0${digits.slice(2)}`;
  }
  return digits.slice(0, 20);
}

export function normalizeEmail(raw: string | null | undefined): string {
  return String(raw ?? '').trim().toLowerCase().slice(0, 240);
}

export function pgPhoneNormSql(column = 'phone'): string {
  return `
    CASE
      WHEN regexp_replace(${column}, '[^0-9]', '', 'g') ~ '^84'
      THEN '0' || substring(regexp_replace(${column}, '[^0-9]', '', 'g') from 3)
      ELSE regexp_replace(${column}, '[^0-9]', '', 'g')
    END
  `;
}
