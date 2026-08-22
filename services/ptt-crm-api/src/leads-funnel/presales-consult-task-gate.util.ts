import {
  PresalesTaskFormValidation,
  validatePresalesTaskFormComplete,
} from './presales-task-form.util';

export function validatePresalesConsultTaskDone(input: {
  stage: string;
  aiPromptKey: string | null | undefined;
  aiOutput: string | null | undefined;
  formFields: unknown;
  formData: Record<string, unknown>;
}): PresalesTaskFormValidation {
  const formResult = validatePresalesTaskFormComplete(input.formFields, input.formData);
  if (!formResult.ok) return formResult;

  if (String(input.stage ?? '').trim() !== 'consult') {
    return { ok: true, missing_labels: [], message: '' };
  }

  const promptKey = String(input.aiPromptKey ?? '').trim();
  const aiOutput = String(input.aiOutput ?? '').trim();
  if (promptKey && !aiOutput) {
    return {
      ok: false,
      missing_labels: ['AI Hỗ trợ'],
      message:
        'Chạy AI Hỗ trợ trước khi ✓ task Consult — bắt buộc QC agency khi task có consult_analysis.',
    };
  }

  return { ok: true, missing_labels: [], message: '' };
}

export function assertPresalesConsultTaskDone(input: {
  stage: string;
  aiPromptKey: string | null | undefined;
  aiOutput: string | null | undefined;
  formFields: unknown;
  formData: Record<string, unknown>;
}): void {
  const result = validatePresalesConsultTaskDone(input);
  if (!result.ok) {
    throw new Error(result.message);
  }
}
