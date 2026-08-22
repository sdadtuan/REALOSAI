const MS_DAY = 86_400_000;

export function isBhytExpiringSoon(validTo: string | null | undefined): boolean {
  if (!validTo) return false;
  const exp = new Date(`${String(validTo).slice(0, 10)}T00:00:00Z`).getTime();
  const now = Date.now();
  return exp - now <= 30 * MS_DAY && exp >= now;
}

export function maskInsuranceNo(value: string | null | undefined, canViewPii: boolean): string {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  if (canViewPii) return raw;
  if (raw.length <= 3) return '•••';
  return `•••• ${raw.slice(-3)}`;
}

export function bodyContainsInsurancePii(body: Record<string, unknown>): boolean {
  return body.bhxh_book_no !== undefined || body.bhyt_card_no !== undefined;
}

export function bodyContainsPeriodSalary(body: Record<string, unknown>): boolean {
  return body.salary_base !== undefined;
}

export function emptyInsuranceRow(staffId: number): import('./hr-insurance.types').HrStaffInsuranceRow {
  return {
    staff_id: staffId,
    bhxh_book_no: '',
    bhxh_joined_on: null,
    bhxh_status: 'active',
    bhxh_document_id: null,
    bhyt_card_no: '',
    bhyt_valid_from: null,
    bhyt_valid_to: null,
    bhyt_clinic_name: '',
    bhyt_document_id: null,
    bhtn_joined_on: null,
    bhtn_status: 'active',
    bhtn_document_id: null,
    notes: '',
    created_at: '',
    updated_at: '',
  };
}
