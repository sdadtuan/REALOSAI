export function w2ActionCopy(message: string): string {
  if (/activate_forbidden/i.test(message)) return 'Chỉ GĐKD được kích hoạt CSBH.';
  if (/legal_gate/i.test(message) && !/hdmb/i.test(message)) {
    return 'Chưa đủ điều kiện mở đợt / giữ chỗ sàn.';
  }
  if (/one_price/i.test(message)) return 'Giá phải khớp CSBH CĐT. Không được kê.';
  if (/\bcontract\b/i.test(message)) return 'Chưa có HĐ phân phối — không cấp giỏ.';
  if (/row_version/i.test(message)) return 'Người khác vừa sửa căn. Làm mới.';
  if (/unit_in_flight/i.test(message)) {
    return 'Không gỡ giỏ — căn đang giữ chỗ hoặc giao dịch.';
  }
  return message;
}
