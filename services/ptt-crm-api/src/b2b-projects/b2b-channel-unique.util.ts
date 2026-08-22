export type ChannelKeyKind = 'page_id' | 'form_id' | 'oa_id' | 'webform_slug' | 'api_key_hash';

export interface ChannelKeyRow {
  kind: ChannelKeyKind;
  value: string;
  projectId: string;
  active: boolean;
}

export function assertChannelKeyAvailable(existing: ChannelKeyRow[], next: ChannelKeyRow): void {
  if (!next.active) return;
  const value = String(next.value ?? '').trim();
  if (!value) {
    throw new Error(`${next.kind} empty`);
  }
  const clash = existing.find(
    (row) =>
      row.active &&
      row.kind === next.kind &&
      row.value === value &&
      row.projectId !== next.projectId,
  );
  if (clash) {
    throw new Error(`${next.kind} already bound to project ${clash.projectId}`);
  }
}
