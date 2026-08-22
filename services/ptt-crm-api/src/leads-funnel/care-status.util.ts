import { CONTACT_OK_CARE_STATUS } from './leads-funnel.types';

/** Trạng thái báo cáo B2 khi liên hệ chưa OK (first_contact). */
export const B2_NEGATIVE_CARE_STATUSES = [
  'khong_nghe_may',
  'khach_khong_tra_loi',
  'khong_goi_duoc',
  'khong_lien_lac_duoc',
  'so_sai',
  'khach_hen_goi_lai',
  'cho_phan_hoi_khach',
  'da_phan_loai',
  'chuyen_cap_truong',
] as const;

export type B2NegativeCareStatus = (typeof B2_NEGATIVE_CARE_STATUSES)[number];

export const CRM_CARE_CONTACT_TYPES = [
  'goi_dien',
  'zalo',
  'email',
  'gap_mat',
  'sms',
  'khac',
] as const;

export const CRM_CARE_STATUS_LABELS: Record<string, string> = {
  da_phan_loai: 'Đã phân loại xong',
  da_lien_he_thanh_cong: 'Đã liên hệ thành công',
  khong_goi_duoc: 'Không gọi được',
  khong_nghe_may: 'Không nghe máy',
  khach_khong_tra_loi: 'Khách không trả lời',
  cho_phan_hoi_khach: 'Chờ phản hồi khách',
  khach_hen_goi_lai: 'Khách hẹn gọi lại',
  khong_lien_lac_duoc: 'Không liên lạc được',
  so_sai: 'Số sai / không tồn tại',
  da_tu_van_xong: 'Đã tư vấn xong',
  chuyen_cap_truong: 'Chuyển cấp / escalation',
  hoan_tat: 'Hoàn tất chăm sóc',
};

const ALLOWED_REPORT_STATUSES = new Set<string>([
  CONTACT_OK_CARE_STATUS,
  ...B2_NEGATIVE_CARE_STATUSES,
]);

export function isContactOkCareStatus(status: string): boolean {
  return status === CONTACT_OK_CARE_STATUS;
}

export function normalizeCareContactType(raw: unknown): string {
  const code = String(raw ?? '').trim().toLowerCase();
  if (code === 'phone') return 'goi_dien';
  return (CRM_CARE_CONTACT_TYPES as readonly string[]).includes(code) ? code : 'goi_dien';
}

/** Validate care_status on care-pipeline/report; defaults to Liên hệ OK when omitted. */
export function normalizeCareReportStatus(raw: unknown): string | null {
  const trimmed = String(raw ?? '').trim().toLowerCase();
  if (!trimmed) return CONTACT_OK_CARE_STATUS;
  return ALLOWED_REPORT_STATUSES.has(trimmed) ? trimmed : null;
}

export function careStatusLabel(code: string): string {
  return CRM_CARE_STATUS_LABELS[code] ?? code;
}
