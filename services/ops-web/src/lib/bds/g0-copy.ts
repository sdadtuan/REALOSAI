export const BDS_REQUIRED_POSITION_LABELS: Record<string, string> = {
  pm_du_an: 'PM dự án',
  gdkd: 'GĐ khối KD',
  truong_pc: 'Trưởng pháp chế',
  truong_collection: 'Trưởng công nợ',
  truong_sp: 'Trưởng sản phẩm',
};

export type BdsG0Status = {
  assigned_position_codes: string[];
  missing_position_codes: string[];
  ready: boolean;
};

export function formatRequiredRoleCodes(codes: string[]): string {
  return codes
    .map((code) => BDS_REQUIRED_POSITION_LABELS[code] ?? code)
    .join(', ');
}

export function g0BannerMessage(missing: string[]): string {
  if (!missing.length) return '';
  return `Thiếu vị trí bắt buộc: ${formatRequiredRoleCodes(missing)}.`;
}

export function launchOpenBlockedTooltip(missing: string[]): string {
  if (!missing.length) return '';
  return `Không thể mở ra quân — ${g0BannerMessage(missing)}`;
}

export function parseBdsApiErrorBody(body: unknown): { error?: string; missing?: string[] } {
  if (!body || typeof body !== 'object') return {};
  const row = body as { error?: unknown; missing?: unknown; message?: unknown };
  if (typeof row.error === 'string') {
    return {
      error: row.error,
      missing: Array.isArray(row.missing) ? row.missing.map(String) : undefined,
    };
  }
  if (row.message && typeof row.message === 'object') {
    return parseBdsApiErrorBody(row.message);
  }
  return {};
}

export function bdsActionErrorMessage(status: number, body: unknown, fallback: string): string {
  const parsed = parseBdsApiErrorBody(body);
  if (parsed.error === 'required_roles' && parsed.missing?.length) {
    return launchOpenBlockedTooltip(parsed.missing);
  }
  if (parsed.error) return `${status} ${parsed.error}`;
  return fallback;
}
