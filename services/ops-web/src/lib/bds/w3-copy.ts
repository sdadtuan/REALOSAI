export function w3ActionCopy(message: string): string {
  if (/scheme_not_draft/i.test(message)) return 'Scheme không còn nháp — tạo scheme mới.';
  if (/scheme_active/i.test(message)) return 'Dự án đã có scheme đang active.';
  if (/split_sum/i.test(message)) return 'Tổng split mốc TX phải bằng 100%.';
  if (/statement_mismatch/i.test(message)) {
    return 'Ledger kỳ không khớp — đối soát lại trước khi khóa.';
  }
  if (/statement_status/i.test(message)) return 'Trạng thái kỳ không cho phép bước này.';
  if (/period_locked/i.test(message)) return 'Kỳ đã khóa — không thêm tạm ứng.';
  if (/advance_cap/i.test(message)) return 'Vượt hạn mức tạm ứng theo hạng đại lý.';
  if (/advance_body/i.test(message)) return 'Nhập đại lý, kỳ và số tiền hợp lệ.';
  if (/\bproject_id\b/i.test(message)) return 'Chọn dự án.';
  if (/\bbase\b/i.test(message)) return 'Cơ sở tính: net hoặc list.';
  return message;
}
