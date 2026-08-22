export const PUBLISHED_VALID_TO_LABEL = 'Hiệu lực lúc gửi';

export function formatPublishedValidTo(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const day = value.trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null;
}

export function publishedValidToFromRow(row: unknown): unknown {
  if (!row || typeof row !== 'object') return null;
  return (row as { published_valid_to?: unknown }).published_valid_to;
}
