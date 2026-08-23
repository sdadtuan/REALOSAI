export type HoldActionKind = 'create' | 'approve' | 'reject' | 'cancel';

export function holdConflictCopy(message: string): string {
  if (/unit_locked/i.test(message)) {
    return 'Căn đã có giữ chỗ — chọn căn khác.';
  }
  return message;
}

export function holdActionError(kind: HoldActionKind, message: string): string {
  const msg = message.trim() || 'Thao tác thất bại';
  return kind === 'create' ? holdConflictCopy(msg) : msg;
}
