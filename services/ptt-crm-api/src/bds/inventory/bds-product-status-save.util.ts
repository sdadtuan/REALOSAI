/** PACK=1 update omits status; keep the row so price edits do not reset sold/locked. */
export function resolveProductStatusForSave(
  existing: string | undefined | null,
  payloadStatus: string | undefined,
  isUpdate: boolean,
): string {
  if (isUpdate && payloadStatus === undefined) {
    return String(existing ?? 'available');
  }
  return String(payloadStatus ?? 'available');
}
