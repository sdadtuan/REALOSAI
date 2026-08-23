export function toPeriodMonthStart(input: string): string {
  const trimmed = String(input ?? '').trim();
  if (/^\d{4}-\d{2}-01$/.test(trimmed)) return trimmed;
  const m = trimmed.match(/^(\d{4})-(\d{2})/);
  if (!m) return trimmed;
  return `${m[1]}-${m[2]}-01`;
}

export function defaultPeriodMonthInput(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}
