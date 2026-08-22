export interface IntakeStakeholderRow {
  role: string;
  role_label: string;
  name: string;
  title: string;
  influence: string;
  notes: string;
}

export const STAKEHOLDER_INFLUENCE_OPTIONS = [
  { value: '', label: '— Mức ảnh hưởng —' },
  { value: 'high', label: 'Cao "High"' },
  { value: 'medium', label: 'Trung bình "Medium"' },
  { value: 'low', label: 'Thấp "Low"' },
] as const;

export function normalizeStakeholders(
  rows: Array<Record<string, string>> | undefined,
): IntakeStakeholderRow[] {
  if (!rows?.length) return defaultStakeholders();
  return rows.map((row) => ({
    role: String(row.role ?? ''),
    role_label: String(row.role_label ?? row.role ?? ''),
    name: String(row.name ?? ''),
    title: String(row.title ?? ''),
    influence: String(row.influence ?? ''),
    notes: String(row.notes ?? ''),
  }));
}

export function defaultStakeholders(): IntakeStakeholderRow[] {
  return [
    {
      role: 'decision_maker',
      role_label: 'Decision Maker',
      name: '',
      title: '',
      influence: '',
      notes: '',
    },
    {
      role: 'influencer',
      role_label: 'Influencer',
      name: '',
      title: '',
      influence: '',
      notes: '',
    },
    {
      role: 'gatekeeper',
      role_label: 'Gatekeeper',
      name: '',
      title: '',
      influence: '',
      notes: '',
    },
    {
      role: 'user',
      role_label: 'User',
      name: '',
      title: '',
      influence: '',
      notes: '',
    },
  ];
}

export function stakeholdersToPatch(rows: IntakeStakeholderRow[]): Array<Record<string, string>> {
  return rows.map((row) => ({
    role: row.role,
    role_label: row.role_label,
    name: row.name.trim().slice(0, 200),
    title: row.title.trim().slice(0, 200),
    influence: row.influence,
    notes: row.notes.trim().slice(0, 500),
  }));
}

export function hasDecisionMakerName(rows: IntakeStakeholderRow[]): boolean {
  const dm = rows.find((r) => r.role === 'decision_maker');
  return Boolean(dm?.name?.trim());
}
