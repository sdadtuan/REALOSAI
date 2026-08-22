export const CONTACT_OK_CARE_STATUS = 'da_lien_he_thanh_cong';

export const B2_NEGATIVE_CARE_OPTIONS = [
  {
    value: 'khong_nghe_may',
    label: 'Không nghe máy',
    hint: 'Ghi thêm activity gọi lại sau 2–4h. Sau 3 lần không nghe → cân nhắc lost.',
    suggestLost: false,
  },
  {
    value: 'khach_khong_tra_loi',
    label: 'Khách không trả lời',
    hint: 'Thử kênh khác (Zalo/SMS). Ghi rõ số lần gọi trong báo cáo.',
    suggestLost: false,
  },
  {
    value: 'khong_goi_duoc',
    label: 'Không gọi được',
    hint: 'Kiểm tra SĐT / nhà mạng. Nếu số lỗi → chọn「Số sai」.',
    suggestLost: false,
  },
  {
    value: 'khong_lien_lac_duoc',
    label: 'Không liên lạc được',
    hint: 'Sau nhiều lần thử → cập nhật trạng thái lost + audit note.',
    suggestLost: true,
  },
  {
    value: 'so_sai',
    label: 'Số sai / không tồn tại',
    hint: 'Cập nhật trạng thái → lost + audit note (sai SĐT).',
    suggestLost: true,
  },
  {
    value: 'khach_hen_goi_lai',
    label: 'Khách hẹn gọi lại',
    hint: 'Ghi thời gian hẹn trong báo cáo; đặt nhắc follow-up.',
    suggestLost: false,
  },
  {
    value: 'cho_phan_hoi_khach',
    label: 'Chờ phản hồi khách',
    hint: 'Đã gửi Zalo/SMS — chờ KH phản hồi trước khi gọi lại.',
    suggestLost: false,
  },
  {
    value: 'da_phan_loai',
    label: 'Đã phân loại xong',
    hint: 'Lead không phù hợp ICP — chuyển lost hoặc báo GDKD nếu deal lớn.',
    suggestLost: true,
  },
  {
    value: 'chuyen_cap_truong',
    label: 'Chuyển cấp / escalation',
    hint: 'Báo Team Lead / GDKD — lead khó hoặc quá hạn SLA.',
    suggestLost: false,
  },
] as const;

export type B2NegativeCareStatus = (typeof B2_NEGATIVE_CARE_OPTIONS)[number]['value'];

export const CRM_CARE_CONTACT_OPTIONS = [
  { value: 'goi_dien', label: 'Gọi điện' },
  { value: 'zalo', label: 'Zalo / chat' },
  { value: 'sms', label: 'SMS' },
  { value: 'email', label: 'Email' },
  { value: 'gap_mat', label: 'Gặp trực tiếp' },
  { value: 'khac', label: 'Khác' },
] as const;

export function b2NegativeCareHint(status: string): string {
  return B2_NEGATIVE_CARE_OPTIONS.find((o) => o.value === status)?.hint ?? '';
}

export function b2NegativeCareLabel(status: string): string {
  return B2_NEGATIVE_CARE_OPTIONS.find((o) => o.value === status)?.label ?? status;
}

export function b2NegativeCareSuggestLost(status: string): boolean {
  return B2_NEGATIVE_CARE_OPTIONS.find((o) => o.value === status)?.suggestLost ?? false;
}
