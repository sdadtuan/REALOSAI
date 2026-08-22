import { API_BASE, parseJson, ApiError } from '@/lib/api';

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

export interface HrStaffIdentityDto {
  staff_id?: number;
  legal_name?: string;
  dob?: string | null;
  gender?: string;
  nationality?: string;
  cccd?: string;
  cccd_issued_on?: string | null;
  cccd_issued_by?: string;
  tax_code?: string;
  bank_name?: string;
  bank_account?: string;
  bank_holder?: string;
  timeclock_pin?: string;
  cccd_masked?: boolean;
  pii_masked?: boolean;
}

export interface HrStaffAddressDto {
  id?: number;
  staff_id?: number;
  kind: 'permanent' | 'temporary' | 'contact';
  province_code?: string;
  district_code?: string;
  ward_code?: string;
  line1?: string;
  same_as_permanent?: boolean;
}

export interface HrStaffProfileDto {
  ok: true;
  staff: {
    id: number;
    name: string;
    phone: string;
    email: string;
    job_title: string;
    department: string;
    internal_code: string;
    active: number;
    dept_name: string;
    started_on: string;
  };
  identity: HrStaffIdentityDto;
  addresses: HrStaffAddressDto[];
  completeness_pct: number;
  wallet_pct: number;
  expiring_count: number;
  can_view_pii: boolean;
  can_edit_pii: boolean;
  can_edit_roster: boolean;
  can_view_docs: boolean;
  can_edit_docs: boolean;
  can_view_contract?: boolean;
  can_edit_contract?: boolean;
  can_view_insurance?: boolean;
  can_edit_insurance?: boolean;
  can_view_dependents?: boolean;
  can_edit_dependents?: boolean;
  can_view_attendance?: boolean;
  can_manage_attendance_device?: boolean;
  active_contract?: HrActiveContractSummaryDto | null;
  insurance_summary?: HrInsuranceSummaryDto | null;
  lifecycle_summary?: HrStaffLifecycleSummaryDto | null;
}

export interface HrInsuranceSummaryDto {
  bhyt_valid_to: string | null;
  bhyt_expiring_soon: boolean;
}

export interface HrStaffLifecycleSummaryDto {
  stage: string;
  stage_label: string;
  stage_changed_on: string | null;
}

export interface HrStaffLifecycleDto extends HrStaffLifecycleSummaryDto {
  staff_id?: number;
  notes?: string;
}

export interface HrStaffDependentDto {
  id: number;
  staff_id: number;
  name: string;
  relation: string;
  dob: string | null;
  tax_dependent: boolean;
  cccd: string;
  cccd_masked?: boolean;
  notes: string;
}

export interface HrHubExpirySummaryDto {
  wallet_expiring_staff: number;
  wallet_low_pct_staff: number;
  contract_expiring_staff: number;
  bhyt_expiring_staff: number;
  samples: Array<{
    staff_id: number;
    name: string;
    internal_code: string;
    kind: string;
    detail: string;
  }>;
}

export interface HrStaffInsuranceDto {
  staff_id: number;
  bhxh_book_no: string;
  bhxh_book_no_masked?: boolean;
  bhxh_joined_on: string | null;
  bhxh_status: string;
  bhxh_document_id: number | null;
  bhxh_document_title?: string | null;
  bhyt_card_no: string;
  bhyt_card_no_masked?: boolean;
  bhyt_valid_from: string | null;
  bhyt_valid_to: string | null;
  bhyt_clinic_name: string;
  bhyt_document_id: number | null;
  bhyt_document_title?: string | null;
  bhtn_joined_on: string | null;
  bhtn_status: string;
  bhtn_document_id: number | null;
  bhtn_document_title?: string | null;
  notes: string;
}

export interface HrInsurancePeriodDto {
  id: number;
  staff_id: number;
  kind: string;
  period_year: number;
  period_month: number;
  salary_base: number | null;
  salary_masked?: boolean;
  notes: string;
}

export interface HrActiveContractSummaryDto {
  id: number;
  contract_no: string;
  kind: string;
  status: string;
  effective_on: string | null;
  expires_on: string | null;
  expiring_soon: boolean;
}

export interface HrLaborAppendixDto {
  id: number;
  contract_id: number;
  appendix_no: string;
  signed_on: string | null;
  effective_on: string | null;
  summary: string;
  salary_gross: number | null;
  salary_masked?: boolean;
  document_id: number | null;
  document_title?: string | null;
}

export interface HrLaborContractDto {
  id: number;
  staff_id: number;
  contract_no: string;
  kind: string;
  signed_on: string | null;
  effective_on: string | null;
  expires_on: string | null;
  salary_gross: number | null;
  salary_masked?: boolean;
  currency: string;
  work_place: string;
  job_title_legal: string;
  status: string;
  document_id: number | null;
  document_title?: string | null;
  notes: string;
  appendices: HrLaborAppendixDto[];
}

export interface HrDocTypeDto {
  type_code: string;
  label: string;
  category: string;
  is_system: boolean;
  is_required_onboard: boolean;
}

export interface HrDocWalletFileDto {
  id: number;
  original_name: string;
  mime_type: string;
  size_bytes: number;
}

export interface HrDocWalletCardDto {
  id: number;
  type_code: string;
  type_label?: string;
  type_category?: string;
  title: string;
  doc_no: string;
  issuer: string;
  issued_on: string | null;
  expires_on: string | null;
  status: string;
  visibility?: string;
  pinned?: boolean;
  submitted_by?: string;
  reviewed_by?: string;
  reviewed_at?: string | null;
  file_count: number;
  files: HrDocWalletFileDto[];
  education?: {
    level: string;
    major: string;
    school: string;
    graduated_on: string | null;
    classification: string;
    training_form: string;
  } | null;
  notes?: string;
}

export interface HrWalletRosterStatDto {
  staff_id: number;
  wallet_pct: number;
  expiring_count: number;
}

export async function fetchHrStaffProfile(token: string, staffId: number): Promise<HrStaffProfileDto> {
  const res = await fetch(`${API_BASE}/api/v1/hr/staff/${staffId}/profile`, {
    headers: authHeaders(token),
    cache: 'no-store',
  });
  const body = await parseJson<HrStaffProfileDto & { error?: string }>(res);
  if (!res.ok) throw new ApiError(body.error ?? 'Không tải được hồ sơ NV', res.status);
  return body;
}

export async function patchHrStaffIdentity(
  token: string,
  staffId: number,
  payload: HrStaffIdentityDto,
): Promise<{ ok: true; identity: HrStaffIdentityDto; completeness_pct: number }> {
  const res = await fetch(`${API_BASE}/api/v1/hr/staff/${staffId}/identity`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
  const body = await parseJson<{ ok: true; identity: HrStaffIdentityDto; completeness_pct: number; error?: string }>(
    res,
  );
  if (!res.ok) throw new ApiError(body.error ?? 'Lưu định danh thất bại', res.status);
  return body;
}

export async function putHrStaffAddresses(
  token: string,
  staffId: number,
  addresses: HrStaffAddressDto[],
): Promise<{ ok: true; addresses: HrStaffAddressDto[]; completeness_pct: number }> {
  const res = await fetch(`${API_BASE}/api/v1/hr/staff/${staffId}/addresses`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify({ addresses }),
  });
  const body = await parseJson<{
    ok: true;
    addresses: HrStaffAddressDto[];
    completeness_pct: number;
    error?: string;
  }>(res);
  if (!res.ok) throw new ApiError(body.error ?? 'Lưu địa chỉ thất bại', res.status);
  return body;
}

export async function fetchHrDocTypes(token: string): Promise<{ types: HrDocTypeDto[] }> {
  const res = await fetch(`${API_BASE}/api/v1/hr/doc-types`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  const body = await parseJson<{ ok: true; types: HrDocTypeDto[]; error?: string }>(res);
  if (!res.ok) throw new ApiError(body.error ?? 'Không tải catalog giấy tờ', res.status);
  return { types: body.types ?? [] };
}

export async function fetchHrStaffWallet(
  token: string,
  staffId: number,
  query?: { category?: string; expiring_only?: boolean; education_only?: boolean; missing_files?: boolean },
): Promise<{ cards: HrDocWalletCardDto[]; wallet_pct: number; expiring_count: number }> {
  const qs = new URLSearchParams();
  if (query?.category) qs.set('category', query.category);
  if (query?.expiring_only) qs.set('expiring_only', '1');
  if (query?.education_only) qs.set('education_only', '1');
  if (query?.missing_files) qs.set('missing_files', '1');
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  const res = await fetch(`${API_BASE}/api/v1/hr/staff/${staffId}/wallet${suffix}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  const body = await parseJson<{
    ok: true;
    cards: HrDocWalletCardDto[];
    wallet_pct: number;
    expiring_count: number;
    error?: string;
  }>(res);
  if (!res.ok) throw new ApiError(body.error ?? 'Không tải ví giấy tờ', res.status);
  return { cards: body.cards ?? [], wallet_pct: body.wallet_pct ?? 0, expiring_count: body.expiring_count ?? 0 };
}

export async function createHrWalletCard(
  token: string,
  staffId: number,
  payload: Record<string, unknown>,
): Promise<HrDocWalletCardDto> {
  const res = await fetch(`${API_BASE}/api/v1/hr/staff/${staffId}/wallet`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
  const body = await parseJson<{ ok: true; card: HrDocWalletCardDto; error?: string }>(res);
  if (!res.ok) throw new ApiError(body.error ?? 'Tạo thẻ thất bại', res.status);
  return body.card;
}

export async function patchHrWalletCard(
  token: string,
  staffId: number,
  cardId: number,
  payload: Record<string, unknown>,
): Promise<HrDocWalletCardDto | null> {
  const res = await fetch(`${API_BASE}/api/v1/hr/staff/${staffId}/wallet/${cardId}`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
  const body = await parseJson<{ ok: true; card?: HrDocWalletCardDto; deleted?: boolean; error?: string }>(res);
  if (!res.ok) throw new ApiError(body.error ?? 'Cập nhật thẻ thất bại', res.status);
  return body.card ?? null;
}

export async function uploadHrWalletFile(
  token: string,
  staffId: number,
  cardId: number,
  file: File,
): Promise<HrDocWalletFileDto> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${API_BASE}/api/v1/hr/staff/${staffId}/wallet/${cardId}/files`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const body = await parseJson<{ ok: true; file: HrDocWalletFileDto; error?: string }>(res);
  if (!res.ok) throw new ApiError(body.error ?? 'Upload thất bại', res.status);
  return body.file;
}

export function hrWalletFileUrl(staffId: number, cardId: number, fileId: number): string {
  return `${API_BASE}/api/v1/hr/staff/${staffId}/wallet/${cardId}/files/${fileId}`;
}

export async function fetchHrWalletRosterStats(
  token: string,
  staffIds: number[],
): Promise<HrWalletRosterStatDto[]> {
  if (!staffIds.length) return [];
  const res = await fetch(
    `${API_BASE}/api/v1/hr/staff/wallet-roster-stats?ids=${staffIds.join(',')}`,
    { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' },
  );
  const body = await parseJson<{ ok: true; items: HrWalletRosterStatDto[]; error?: string }>(res);
  if (!res.ok) return [];
  return body.items ?? [];
}

export async function fetchHrLaborContracts(
  token: string,
  staffId: number,
): Promise<{ contracts: HrLaborContractDto[]; active_contract: HrActiveContractSummaryDto | null }> {
  const res = await fetch(`${API_BASE}/api/v1/hr/staff/${staffId}/contracts`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  const body = await parseJson<{
    ok: true;
    contracts: HrLaborContractDto[];
    active_contract: HrActiveContractSummaryDto | null;
    error?: string;
  }>(res);
  if (!res.ok) throw new ApiError(body.error ?? 'Không tải hợp đồng', res.status);
  return { contracts: body.contracts ?? [], active_contract: body.active_contract ?? null };
}

export async function createHrLaborContract(
  token: string,
  staffId: number,
  payload: Record<string, unknown>,
): Promise<HrLaborContractDto> {
  const res = await fetch(`${API_BASE}/api/v1/hr/staff/${staffId}/contracts`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
  const body = await parseJson<{ ok: true; contract: HrLaborContractDto; error?: string }>(res);
  if (!res.ok) throw new ApiError(body.error ?? 'Tạo hợp đồng thất bại', res.status);
  return body.contract;
}

export async function patchHrLaborContract(
  token: string,
  staffId: number,
  contractId: number,
  payload: Record<string, unknown>,
): Promise<HrLaborContractDto> {
  const res = await fetch(`${API_BASE}/api/v1/hr/staff/${staffId}/contracts/${contractId}`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
  const body = await parseJson<{ ok: true; contract: HrLaborContractDto; error?: string }>(res);
  if (!res.ok) throw new ApiError(body.error ?? 'Cập nhật hợp đồng thất bại', res.status);
  return body.contract;
}

export async function createHrLaborAppendix(
  token: string,
  staffId: number,
  contractId: number,
  payload: Record<string, unknown>,
): Promise<HrLaborAppendixDto> {
  const res = await fetch(`${API_BASE}/api/v1/hr/staff/${staffId}/contracts/${contractId}/appendices`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
  const body = await parseJson<{ ok: true; appendix: HrLaborAppendixDto; error?: string }>(res);
  if (!res.ok) throw new ApiError(body.error ?? 'Tạo phụ lục thất bại', res.status);
  return body.appendix;
}

export async function patchHrLaborAppendix(
  token: string,
  staffId: number,
  contractId: number,
  appendixId: number,
  payload: Record<string, unknown>,
): Promise<HrLaborAppendixDto> {
  const res = await fetch(
    `${API_BASE}/api/v1/hr/staff/${staffId}/contracts/${contractId}/appendices/${appendixId}`,
    {
      method: 'PATCH',
      headers: authHeaders(token),
      body: JSON.stringify(payload),
    },
  );
  const body = await parseJson<{ ok: true; appendix: HrLaborAppendixDto; error?: string }>(res);
  if (!res.ok) throw new ApiError(body.error ?? 'Cập nhật phụ lục thất bại', res.status);
  return body.appendix;
}

export async function fetchHrStaffInsurance(
  token: string,
  staffId: number,
): Promise<{
  register: HrStaffInsuranceDto;
  periods: HrInsurancePeriodDto[];
  summary: HrInsuranceSummaryDto | null;
}> {
  const res = await fetch(`${API_BASE}/api/v1/hr/staff/${staffId}/insurance`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  const body = await parseJson<{
    ok: true;
    register: HrStaffInsuranceDto;
    periods: HrInsurancePeriodDto[];
    summary: HrInsuranceSummaryDto | null;
    error?: string;
  }>(res);
  if (!res.ok) throw new ApiError(body.error ?? 'Không tải sổ bảo hiểm', res.status);
  return {
    register: body.register,
    periods: body.periods ?? [],
    summary: body.summary ?? null,
  };
}

export async function putHrStaffInsurance(
  token: string,
  staffId: number,
  payload: Record<string, unknown>,
): Promise<{ register: HrStaffInsuranceDto; summary: HrInsuranceSummaryDto | null }> {
  const res = await fetch(`${API_BASE}/api/v1/hr/staff/${staffId}/insurance`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
  const body = await parseJson<{
    ok: true;
    register: HrStaffInsuranceDto;
    summary: HrInsuranceSummaryDto | null;
    error?: string;
  }>(res);
  if (!res.ok) throw new ApiError(body.error ?? 'Lưu sổ BH thất bại', res.status);
  return { register: body.register, summary: body.summary ?? null };
}

export async function createHrInsurancePeriod(
  token: string,
  staffId: number,
  payload: Record<string, unknown>,
): Promise<HrInsurancePeriodDto> {
  const res = await fetch(`${API_BASE}/api/v1/hr/staff/${staffId}/insurance/periods`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
  const body = await parseJson<{ ok: true; period: HrInsurancePeriodDto; error?: string }>(res);
  if (!res.ok) throw new ApiError(body.error ?? 'Thêm kỳ đóng thất bại', res.status);
  return body.period;
}

export async function fetchHrStaffDependents(
  token: string,
  staffId: number,
): Promise<{ dependents: HrStaffDependentDto[] }> {
  const res = await fetch(`${API_BASE}/api/v1/hr/staff/${staffId}/dependents`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  const body = await parseJson<{ ok: true; dependents: HrStaffDependentDto[]; error?: string }>(res);
  if (!res.ok) throw new ApiError(body.error ?? 'Không tải người phụ thuộc', res.status);
  return { dependents: body.dependents ?? [] };
}

export async function createHrStaffDependent(
  token: string,
  staffId: number,
  payload: Record<string, unknown>,
): Promise<{ dependent: HrStaffDependentDto }> {
  const res = await fetch(`${API_BASE}/api/v1/hr/staff/${staffId}/dependents`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
  const body = await parseJson<{ ok: true; dependent: HrStaffDependentDto; error?: string }>(res);
  if (!res.ok) throw new ApiError(body.error ?? 'Thêm người phụ thuộc thất bại', res.status);
  return { dependent: body.dependent };
}

export async function patchHrStaffDependent(
  token: string,
  staffId: number,
  depId: number,
  payload: Record<string, unknown>,
): Promise<{ dependent: HrStaffDependentDto }> {
  const res = await fetch(`${API_BASE}/api/v1/hr/staff/${staffId}/dependents/${depId}`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
  const body = await parseJson<{ ok: true; dependent: HrStaffDependentDto; error?: string }>(res);
  if (!res.ok) throw new ApiError(body.error ?? 'Cập nhật người phụ thuộc thất bại', res.status);
  return { dependent: body.dependent };
}

export async function deleteHrStaffDependent(
  token: string,
  staffId: number,
  depId: number,
): Promise<void> {
  const res = await fetch(`${API_BASE}/api/v1/hr/staff/${staffId}/dependents/${depId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await parseJson<{ ok?: boolean; error?: string }>(res);
  if (!res.ok) throw new ApiError(body.error ?? 'Xóa người phụ thuộc thất bại', res.status);
}

export async function fetchHrStaffLifecycle(
  token: string,
  staffId: number,
): Promise<{
  lifecycle: HrStaffLifecycleDto;
  official_gate: { ok: boolean; missing: string[] };
}> {
  const res = await fetch(`${API_BASE}/api/v1/hr/staff/${staffId}/lifecycle`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  const body = await parseJson<{
    ok: true;
    lifecycle: HrStaffLifecycleDto;
    official_gate: { ok: boolean; missing: string[] };
    error?: string;
  }>(res);
  if (!res.ok) throw new ApiError(body.error ?? 'Không tải lifecycle', res.status);
  return { lifecycle: body.lifecycle, official_gate: body.official_gate };
}

export async function patchHrStaffLifecycle(
  token: string,
  staffId: number,
  payload: Record<string, unknown>,
): Promise<{ lifecycle: HrStaffLifecycleDto }> {
  const res = await fetch(`${API_BASE}/api/v1/hr/staff/${staffId}/lifecycle`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
  const body = await parseJson<{ ok: true; lifecycle: HrStaffLifecycleDto; error?: string }>(res);
  if (!res.ok) throw new ApiError(body.error ?? 'Cập nhật lifecycle thất bại', res.status);
  return { lifecycle: body.lifecycle };
}

export async function fetchHrHubExpirySummary(token: string): Promise<HrHubExpirySummaryDto> {
  const res = await fetch(`${API_BASE}/api/v1/hr/hub/expiry-summary`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  const body = await parseJson<{ ok: true; summary: HrHubExpirySummaryDto; error?: string }>(res);
  if (!res.ok) throw new ApiError(body.error ?? 'Không tải cảnh báo hết hạn', res.status);
  return body.summary;
}

export interface HrPendingWalletItemDto extends HrDocWalletCardDto {
  staff_id: number;
  staff_name: string;
  internal_code: string;
}

export async function fetchHrMyWalletSubmitTypes(token: string): Promise<{ types: HrDocTypeDto[] }> {
  const res = await fetch(`${API_BASE}/api/v1/hr/me/wallet/types`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  const body = await parseJson<{ ok: true; types: HrDocTypeDto[]; error?: string }>(res);
  if (!res.ok) throw new ApiError(body.error ?? 'Không tải loại giấy tờ', res.status);
  return { types: body.types ?? [] };
}

export async function fetchHrMyWallet(token: string): Promise<{
  staff_id: number;
  cards: HrDocWalletCardDto[];
  wallet_pct: number;
  expiring_count: number;
}> {
  const res = await fetch(`${API_BASE}/api/v1/hr/me/wallet`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  const body = await parseJson<{
    ok: true;
    staff_id: number;
    cards: HrDocWalletCardDto[];
    wallet_pct: number;
    expiring_count: number;
    error?: string;
  }>(res);
  if (!res.ok) throw new ApiError(body.error ?? 'Không tải ví của tôi', res.status);
  return {
    staff_id: body.staff_id,
    cards: body.cards ?? [],
    wallet_pct: body.wallet_pct ?? 0,
    expiring_count: body.expiring_count ?? 0,
  };
}

export async function submitHrMyWalletCard(
  token: string,
  payload: Record<string, unknown>,
): Promise<HrDocWalletCardDto> {
  const res = await fetch(`${API_BASE}/api/v1/hr/me/wallet`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
  const body = await parseJson<{ ok: true; card: HrDocWalletCardDto; error?: string }>(res);
  if (!res.ok) throw new ApiError(body.error ?? 'Nộp thẻ thất bại', res.status);
  return body.card;
}

export async function uploadHrMyWalletFile(token: string, cardId: number, file: File): Promise<HrDocWalletFileDto> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${API_BASE}/api/v1/hr/me/wallet/${cardId}/files`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const body = await parseJson<{ ok: true; file: HrDocWalletFileDto; error?: string }>(res);
  if (!res.ok) throw new ApiError(body.error ?? 'Upload thất bại', res.status);
  return body.file;
}

export function hrMyWalletFileUrl(cardId: number, fileId: number): string {
  return `${API_BASE}/api/v1/hr/me/wallet/${cardId}/files/${fileId}`;
}

export async function openHrMyWalletFile(token: string, cardId: number, fileId: number): Promise<void> {
  const res = await fetch(hrMyWalletFileUrl(cardId, fileId), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new ApiError('Không mở được file', res.status);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank', 'noopener,noreferrer');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export async function fetchHrPendingWalletReview(token: string): Promise<{
  items: HrPendingWalletItemDto[];
  pending_count: number;
}> {
  const res = await fetch(`${API_BASE}/api/v1/hr/wallet/pending-review`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  const body = await parseJson<{
    ok: true;
    items: HrPendingWalletItemDto[];
    pending_count: number;
    error?: string;
  }>(res);
  if (!res.ok) throw new ApiError(body.error ?? 'Không tải hàng chờ duyệt', res.status);
  return { items: body.items ?? [], pending_count: body.pending_count ?? 0 };
}

export async function approveHrWalletCard(
  token: string,
  staffId: number,
  cardId: number,
  notes?: string,
): Promise<HrDocWalletCardDto> {
  const res = await fetch(`${API_BASE}/api/v1/hr/staff/${staffId}/wallet/${cardId}/approve`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify({ notes: notes ?? '' }),
  });
  const body = await parseJson<{ ok: true; card: HrDocWalletCardDto; error?: string }>(res);
  if (!res.ok) throw new ApiError(body.error ?? 'Duyệt thẻ thất bại', res.status);
  return body.card;
}

export async function rejectHrWalletCard(
  token: string,
  staffId: number,
  cardId: number,
  notes?: string,
): Promise<HrDocWalletCardDto> {
  const res = await fetch(`${API_BASE}/api/v1/hr/staff/${staffId}/wallet/${cardId}/reject`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify({ notes: notes ?? '' }),
  });
  const body = await parseJson<{ ok: true; card: HrDocWalletCardDto; error?: string }>(res);
  if (!res.ok) throw new ApiError(body.error ?? 'Từ chối thẻ thất bại', res.status);
  return body.card;
}

export async function downloadHrWalletAccountingXlsx(token: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/v1/hr/wallet/export/accounting.xlsx`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const body = await parseJson<{ error?: string }>(res);
    throw new ApiError(body.error ?? 'Export thất bại', res.status);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `hr-wallet-accounting-${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export interface HrAttendancePunchDto {
  id: number;
  staff_id: number | null;
  staff_name: string | null;
  punched_at: string;
  direction: 'in' | 'out' | 'auto';
  source: 'device' | 'gps' | 'manual';
  device_id: number | null;
  device_name: string | null;
  site_id: number | null;
  site_name: string | null;
  pin: string;
  lat: number | null;
  lng: number | null;
  accuracy_m: number | null;
  outside_geofence: boolean;
  status: 'accepted' | 'pending_review' | 'rejected' | 'duplicate';
  note: string;
  created_at: string;
}

export interface HrAttendanceDayDto {
  work_date: string;
  check_in: string;
  check_out: string;
  break_minutes: number;
  note: string;
  punch_count: number;
  sources: string[];
}

export interface HrAttendanceDeviceDto {
  id: number;
  name: string;
  serial: string;
  site_name: string;
  timezone: string;
  last_seen_at: string | null;
  is_active: boolean;
}

export async function fetchHrStaffAttendance(
  token: string,
  staffId: number,
  from?: string,
  to?: string,
): Promise<{ punches: HrAttendancePunchDto[]; days: HrAttendanceDayDto[]; today: string }> {
  const qs = new URLSearchParams();
  if (from) qs.set('from', from);
  if (to) qs.set('to', to);
  const res = await fetch(`${API_BASE}/api/v1/hr/staff/${staffId}/attendance?${qs}`, {
    headers: authHeaders(token),
  });
  const body = await parseJson<{
    ok: true;
    punches: HrAttendancePunchDto[];
    days: HrAttendanceDayDto[];
    today: string;
    error?: string;
  }>(res);
  if (!res.ok) throw new ApiError(body.error ?? 'Không tải chấm công', res.status);
  return { punches: body.punches, days: body.days, today: body.today };
}

export async function fetchHrAttendanceDevices(token: string): Promise<HrAttendanceDeviceDto[]> {
  const res = await fetch(`${API_BASE}/api/v1/hr/attendance/devices`, {
    headers: authHeaders(token),
  });
  const body = await parseJson<{ ok: true; devices: HrAttendanceDeviceDto[]; error?: string }>(res);
  if (!res.ok) throw new ApiError(body.error ?? 'Không tải thiết bị', res.status);
  return body.devices;
}

export async function createHrAttendanceDevice(
  token: string,
  input: { name: string; serial?: string; site_name?: string },
): Promise<{ device: HrAttendanceDeviceDto; device_key: string }> {
  const res = await fetch(`${API_BASE}/api/v1/hr/attendance/devices`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(input),
  });
  const body = await parseJson<{
    ok: true;
    device: HrAttendanceDeviceDto;
    device_key: string;
    error?: string;
  }>(res);
  if (!res.ok) throw new ApiError(body.error ?? 'Tạo thiết bị thất bại', res.status);
  return { device: body.device, device_key: body.device_key };
}

export async function importHrAttendanceCsv(
  token: string,
  csv: string,
  deviceId?: number,
): Promise<{ imported: number; accepted: number; duplicate: number; pending_review: number }> {
  const res = await fetch(`${API_BASE}/api/v1/hr/attendance/device/import.csv`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ csv, device_id: deviceId }),
  });
  const body = await parseJson<{
    ok: true;
    imported: number;
    accepted: number;
    duplicate: number;
    pending_review: number;
    error?: string;
  }>(res);
  if (!res.ok) throw new ApiError(body.error ?? 'Import CSV thất bại', res.status);
  return body;
}

export async function fetchHrUnmappedAttendancePins(token: string): Promise<HrAttendancePunchDto[]> {
  const res = await fetch(`${API_BASE}/api/v1/hr/attendance/unmapped`, {
    headers: authHeaders(token),
  });
  const body = await parseJson<{ ok: true; punches: HrAttendancePunchDto[]; error?: string }>(res);
  if (!res.ok) throw new ApiError(body.error ?? 'Không tải PIN lỗi', res.status);
  return body.punches;
}

export async function fetchHrAttendanceHubSummary(token: string): Promise<{
  unmapped_pins: number;
  devices_offline: number;
  missing_checkin_today: number;
  gps_pending_review: number;
}> {
  const res = await fetch(`${API_BASE}/api/v1/hr/attendance/hub-summary`, {
    headers: authHeaders(token),
  });
  const body = await parseJson<{
    ok: true;
    unmapped_pins: number;
    devices_offline: number;
    missing_checkin_today: number;
    gps_pending_review: number;
    error?: string;
  }>(res);
  if (!res.ok) throw new ApiError(body.error ?? 'Không tải tóm tắt chấm công', res.status);
  return body;
}

export interface HrAttendanceSiteDto {
  id: number;
  name: string;
  lat: number;
  lng: number;
  radius_m: number;
  is_active: boolean;
  staff_count: number;
}

export async function fetchHrAttendanceSites(token: string): Promise<HrAttendanceSiteDto[]> {
  const res = await fetch(`${API_BASE}/api/v1/hr/attendance/sites`, {
    headers: authHeaders(token),
  });
  const body = await parseJson<{ ok: true; sites: HrAttendanceSiteDto[]; error?: string }>(res);
  if (!res.ok) throw new ApiError(body.error ?? 'Không tải site', res.status);
  return body.sites;
}

export async function createHrAttendanceSite(
  token: string,
  input: { name: string; lat: number; lng: number; radius_m?: number },
): Promise<HrAttendanceSiteDto> {
  const res = await fetch(`${API_BASE}/api/v1/hr/attendance/sites`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(input),
  });
  const body = await parseJson<{ ok: true; site: HrAttendanceSiteDto; error?: string }>(res);
  if (!res.ok) throw new ApiError(body.error ?? 'Tạo site thất bại', res.status);
  return body.site;
}

export async function assignHrAttendanceSiteStaff(
  token: string,
  siteId: number,
  staffIds: number[],
): Promise<void> {
  const res = await fetch(`${API_BASE}/api/v1/hr/attendance/sites/${siteId}/staff`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify({ staff_ids: staffIds }),
  });
  const body = await parseJson<{ ok: true; error?: string }>(res);
  if (!res.ok) throw new ApiError(body.error ?? 'Gán NV thất bại', res.status);
}

export async function fetchMyAttendanceSites(token: string): Promise<{ staff_id: number; sites: HrAttendanceSiteDto[] }> {
  const res = await fetch(`${API_BASE}/api/v1/hr/me/attendance/sites`, {
    headers: authHeaders(token),
  });
  const body = await parseJson<{
    ok: true;
    staff_id: number;
    sites: HrAttendanceSiteDto[];
    error?: string;
  }>(res);
  if (!res.ok) throw new ApiError(body.error ?? 'Không tải site của tôi', res.status);
  return { staff_id: body.staff_id, sites: body.sites };
}

export async function submitGpsPunch(
  token: string,
  input: {
    direction: 'in' | 'out';
    lat: number;
    lng: number;
    accuracy_m?: number;
    punched_at?: string;
  },
): Promise<{
  punch: HrAttendancePunchDto;
  pending_review: boolean;
  matched_site: HrAttendanceSiteDto | null;
  distance_m: number | null;
}> {
  const res = await fetch(`${API_BASE}/api/v1/hr/attendance/gps/punch`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(input),
  });
  const body = await parseJson<{
    ok: true;
    punch: HrAttendancePunchDto;
    pending_review: boolean;
    matched_site: HrAttendanceSiteDto | null;
    distance_m: number | null;
    error?: string;
  }>(res);
  if (!res.ok) throw new ApiError(body.error ?? 'Chấm GPS thất bại', res.status);
  return body;
}

export async function fetchHrGpsPendingReview(token: string): Promise<HrAttendancePunchDto[]> {
  const res = await fetch(`${API_BASE}/api/v1/hr/attendance/gps/pending-review`, {
    headers: authHeaders(token),
  });
  const body = await parseJson<{ ok: true; punches: HrAttendancePunchDto[]; error?: string }>(res);
  if (!res.ok) throw new ApiError(body.error ?? 'Không tải hàng chờ GPS', res.status);
  return body.punches;
}

export async function reviewHrAttendancePunch(
  token: string,
  punchId: number,
  action: 'accept' | 'reject',
  note?: string,
): Promise<HrAttendancePunchDto> {
  const res = await fetch(`${API_BASE}/api/v1/hr/attendance/punches/${punchId}/review`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ action, note: note ?? '' }),
  });
  const body = await parseJson<{ ok: true; punch: HrAttendancePunchDto; error?: string }>(res);
  if (!res.ok) throw new ApiError(body.error ?? 'Duyệt punch thất bại', res.status);
  return body.punch;
}
