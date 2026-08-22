export interface PresalesFormField {
  key: string;
  label: string;
  type: string;
  required: boolean;
}

export interface PresalesTaskFormValidation {
  ok: boolean;
  missing_labels: string[];
  message: string;
}

export function parsePresalesFormFields(raw: unknown): PresalesFormField[] {
  if (!Array.isArray(raw)) return [];
  const out: PresalesFormField[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const row = item as Record<string, unknown>;
    const key = String(row.key ?? '').trim();
    if (!key) continue;
    out.push({
      key,
      label: String(row.label ?? key).trim() || key,
      type: String(row.type ?? 'text').trim().toLowerCase() || 'text',
      required: row.required !== false,
    });
  }
  return out;
}

export function presalesFieldValuePresent(type: string, value: unknown): boolean {
  if (value === null || value === undefined) return false;
  const t = String(type || 'text').trim().toLowerCase();
  if (t === 'number') {
    if (typeof value === 'number') return Number.isFinite(value);
    const raw = String(value).trim();
    if (!raw) return false;
    return Number.isFinite(Number(raw));
  }
  if (t === 'checkbox' || t === 'boolean') {
    return value === true || value === 'true' || value === 1 || value === '1';
  }
  return String(value).trim().length > 0;
}

export function mergePresalesFormData(
  existing: Record<string, unknown> | null | undefined,
  patch: Record<string, unknown> | undefined,
): Record<string, unknown> {
  const base =
    existing && typeof existing === 'object' && !Array.isArray(existing)
      ? { ...existing }
      : {};
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
    return base;
  }
  return { ...base, ...patch };
}

export function validatePresalesTaskFormComplete(
  formFieldsRaw: unknown,
  formData: Record<string, unknown>,
): PresalesTaskFormValidation {
  const fields = parsePresalesFormFields(formFieldsRaw);
  if (!fields.length) {
    return { ok: true, missing_labels: [], message: '' };
  }
  const missing = fields
    .filter((field) => field.required)
    .filter((field) => !presalesFieldValuePresent(field.type, formData[field.key]))
    .map((field) => field.label);
  if (!missing.length) {
    return { ok: true, missing_labels: [], message: '' };
  }
  return {
    ok: false,
    missing_labels: missing,
    message: `Điền đủ trường trước khi hoàn thành task: ${missing.join(', ')}`,
  };
}

export function assertPresalesTaskFormComplete(
  formFieldsRaw: unknown,
  formData: Record<string, unknown>,
): void {
  const result = validatePresalesTaskFormComplete(formFieldsRaw, formData);
  if (!result.ok) {
    throw new Error(result.message);
  }
}
