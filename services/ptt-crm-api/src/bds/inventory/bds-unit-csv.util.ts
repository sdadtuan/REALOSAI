import type { ImportUnitRow } from './bds-inventory.types';

export function parseUnitCsv(csv: string): ImportUnitRow[] {
  const text = String(csv ?? '').replace(/^\uFEFF/, '').trim();
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '');
  if (!lines.length) return [];
  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
  if (!headers.includes('unit_code')) throw new Error('unit_code');
  return lines.slice(1).map((line) => {
    const cells = line.split(',');
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = (cells[i] ?? '').trim();
    });
    return row as ImportUnitRow;
  });
}
