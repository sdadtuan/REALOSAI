export function offboardHoldDisclaimer(): string {
  return 'Hold chưa cọc sẽ mở căn (available). Hold đã cọc + giao dịch giữ căn — không mở.';
}

export function offboardHoldSummary(input: {
  holds_released?: number;
  holds_kept?: number;
  tickets_reassigned?: number;
}): string {
  const released = Number(input.holds_released ?? 0);
  const kept = Number(input.holds_kept ?? 0);
  const tickets = Number(input.tickets_reassigned ?? 0);
  return `Hold mở ${released} · giữ ${kept} · việc chuyển trưởng ${tickets}.`;
}
