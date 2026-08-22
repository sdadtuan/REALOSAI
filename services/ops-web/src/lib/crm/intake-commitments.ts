export interface IntakeCommitmentRow {
  label: string;
  detail: string;
  deadline: string;
}

export function normalizeCommitments(
  rows: Array<Record<string, string>> | undefined,
): IntakeCommitmentRow[] {
  if (!rows?.length) return defaultCommitments();
  return rows.map((row, index) => ({
    label: String(row.label ?? defaultCommitments()[index]?.label ?? `Cam kết ${index + 1}`),
    detail: String(row.detail ?? ''),
    deadline: String(row.deadline ?? ''),
  }));
}

export function defaultCommitments(): IntakeCommitmentRow[] {
  return [
    { label: 'Cam kết 1 — Thông tin', detail: '', deadline: '' },
    { label: 'Cam kết 2 — Thời gian', detail: '', deadline: '' },
    { label: 'Cam kết 3 — Ngân sách / quyết định', detail: '', deadline: '' },
  ];
}

export function commitmentsToPatch(rows: IntakeCommitmentRow[]): Array<Record<string, string>> {
  return rows.map((row) => ({
    label: row.label,
    detail: row.detail.trim().slice(0, 1000),
    deadline: row.deadline.trim().slice(0, 120),
  }));
}

export function countFilledCommitments(rows: IntakeCommitmentRow[]): number {
  return rows.filter((row) => row.detail.trim()).length;
}
