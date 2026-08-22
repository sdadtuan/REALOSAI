import { JOB_FUNCTION_CATALOG } from '../staff-permissions/staff-job-functions.catalog';

export type SodViolation = {
  id: string;
  message: string;
};

const VALID_CODES = new Set(JOB_FUNCTION_CATALOG.map((f) => f.code));

export function normalizeFunctionCodes(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const item of raw) {
    const code = String(item ?? '').trim();
    if (!code || !VALID_CODES.has(code)) continue;
    if (!out.includes(code)) out.push(code);
  }
  return out.sort();
}

export function detectJobFunctionSod(functions: string[]): SodViolation | null {
  const set = new Set(functions);
  if (set.has('content') && set.has('compliance')) {
    return {
      id: '02',
      message: 'Content và Compliance không nên gán cùng user (SoD-02).',
    };
  }
  if (set.has('design') && set.has('compliance')) {
    return {
      id: '02',
      message: 'Design và Compliance không nên gán cùng user (SoD-02).',
    };
  }
  return null;
}

export function validateJobFunctionAssignment(functions: string[]): SodViolation | null {
  if (functions.length > 3) {
    return {
      id: 'max',
      message: 'Tối đa 3 job function trên mỗi user.',
    };
  }
  return detectJobFunctionSod(functions);
}
