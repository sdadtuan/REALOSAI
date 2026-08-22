import type { HrStaffIdentityRow } from './hr-employee-file.types';

export function maskCccd(value: string): string {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  if (raw.length <= 4) return '••••';
  return `•••• ${raw.slice(-3)}`;
}

export function maskGenericPii(value: string): string {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  if (raw.length <= 4) return '••••';
  return `•••• ${raw.slice(-4)}`;
}

export function maskIdentityForApi(
  row: HrStaffIdentityRow | null,
  canViewPii: boolean,
): Partial<HrStaffIdentityRow> & { cccd_masked?: boolean; pii_masked?: boolean } {
  if (!row) {
    return {
      staff_id: 0,
      legal_name: '',
      dob: null,
      gender: '',
      nationality: 'VN',
      cccd: '',
      cccd_issued_on: null,
      cccd_issued_by: '',
      tax_code: '',
      bank_name: '',
      bank_account: '',
      bank_holder: '',
      timeclock_pin: '',
      created_at: '',
      updated_at: '',
    };
  }
  if (canViewPii) return { ...row };
  return {
    ...row,
    cccd: maskCccd(row.cccd),
    tax_code: maskGenericPii(row.tax_code),
    bank_account: maskGenericPii(row.bank_account),
    bank_name: row.bank_name ? '••••' : '',
    bank_holder: row.bank_holder ? '••••' : '',
    cccd_masked: Boolean(row.cccd),
    pii_masked: true,
  };
}

export function computeProfileCompleteness(
  identity: HrStaffIdentityRow | null,
  addresses: Array<{ kind: string; line1: string; same_as_permanent?: boolean }>,
): number {
  let filled = 0;
  const total = 5;
  if (identity?.legal_name?.trim()) filled += 1;
  if (identity?.cccd?.trim()) filled += 1;
  if (identity?.dob) filled += 1;
  const permanent = addresses.find((a) => a.kind === 'permanent');
  const temporary = addresses.find((a) => a.kind === 'temporary');
  if (permanent?.line1?.trim()) filled += 1;
  if (temporary?.line1?.trim() || temporary?.same_as_permanent) filled += 1;
  return Math.round((filled / total) * 100);
}

export function bodyContainsPiiFields(body: Record<string, unknown>): boolean {
  return ['cccd', 'tax_code', 'bank_name', 'bank_account', 'bank_holder'].some(
    (k) => body[k] !== undefined,
  );
}
