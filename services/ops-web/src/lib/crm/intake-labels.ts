export const BANT_FIELD_LABELS: Record<
  'budget' | 'authority' | 'need' | 'timeline' | 'fit' | 'history',
  { label: string; hint: string }
> = {
  budget: {
    label: 'Ngân sách "Budget"',
    hint: 'Ngân sách thực tế/tháng hoặc dự án? Ai duyệt chi?',
  },
  authority: {
    label: 'Thẩm quyền "Authority"',
    hint: 'Ai ký HĐ? Ai quyết định cuối cùng?',
  },
  need: {
    label: 'Nhu cầu "Need"',
    hint: 'Điểm đau #1? Hậu quả nếu không giải quyết?',
  },
  timeline: {
    label: 'Thời hạn "Timeline"',
    hint: 'Khi nào cần bắt đầu? Deadline campaign/go-live?',
  },
  fit: {
    label: 'Độ phù hợp "Fit"',
    hint: 'Phù hợp ICP PTT? Scope trong năng lực?',
  },
  history: {
    label: 'Lịch sử "History"',
    hint: 'Đã thử gì? Agency cũ? Kết quả?',
  },
};

export const INTAKE_DECISION_OPTIONS = [
  { value: '', label: '— Chọn quyết định —' },
  { value: 'go', label: 'Tiếp tục "Go"' },
  { value: 'nurture', label: 'Nuôi dưỡng "Nurture"' },
  { value: 'no_go', label: 'Từ chối "No-Go"' },
] as const;

export const INTAKE_MODE_LABELS: Record<string, string> = {
  phone: 'Gọi điện "Phone"',
  in_person: 'Gặp trực tiếp "In person"',
};

export const INTAKE_STATUS_LABELS: Record<string, string> = {
  draft: 'Nháp "Draft"',
  completed: 'Hoàn thành "Completed"',
};

export function intakeModeLabel(mode: string | null | undefined): string {
  return INTAKE_MODE_LABELS[mode ?? ''] ?? mode ?? '—';
}

export function intakeStatusLabel(status: string | null | undefined): string {
  return INTAKE_STATUS_LABELS[status ?? ''] ?? status ?? '—';
}

export function plainTextToRichHtml(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (/^\s*</.test(trimmed)) return trimmed;
  return trimmed
    .split(/\n{2,}/)
    .map((block) => `<p>${block.replace(/\n/g, '<br>')}</p>`)
    .join('');
}
