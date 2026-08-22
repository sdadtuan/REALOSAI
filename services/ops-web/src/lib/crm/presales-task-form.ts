export interface PresalesFormField {
  key: string;
  label: string;
  type: string;
  required: boolean;
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

function fieldValuePresent(type: string, value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (type === 'number') {
    const raw = String(value).trim();
    return raw.length > 0 && Number.isFinite(Number(raw));
  }
  return String(value).trim().length > 0;
}

export function validatePresalesTaskForm(
  formFields: unknown,
  formData: Record<string, unknown>,
): string | null {
  const missing = parsePresalesFormFields(formFields)
    .filter((field) => field.required)
    .filter((field) => !fieldValuePresent(field.type, formData[field.key]))
    .map((field) => field.label);
  if (!missing.length) return null;
  return `Điền đủ trường trước khi hoàn thành task: ${missing.join(', ')}`;
}

export function validatePresalesConsultTaskDoneClient(input: {
  stage?: string;
  aiPromptKey?: string;
  aiOutput?: string;
  formFields: unknown;
  formData: Record<string, unknown>;
}): string | null {
  const formErr = validatePresalesTaskForm(input.formFields, input.formData);
  if (formErr) return formErr;
  if (String(input.stage ?? '') !== 'consult') return null;
  const promptKey = String(input.aiPromptKey ?? '').trim();
  const aiOutput = String(input.aiOutput ?? '').trim();
  if (promptKey && !aiOutput) {
    return 'Chạy AI Hỗ trợ trước khi ✓ task Consult — bắt buộc QC agency.';
  }
  return null;
}

export function mergePresalesFormData(
  existing: Record<string, unknown> | undefined,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  return { ...(existing ?? {}), ...patch };
}
