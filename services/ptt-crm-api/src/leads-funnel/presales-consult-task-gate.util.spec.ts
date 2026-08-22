import {
  assertPresalesConsultTaskDone,
  validatePresalesConsultTaskDone,
} from './presales-consult-task-gate.util';

describe('presales-consult-task-gate.util', () => {
  const fields = [{ key: 'niche', label: 'Ngành', type: 'text', required: true }];

  it('blocks consult done without AI output when prompt configured', () => {
    const result = validatePresalesConsultTaskDone({
      stage: 'consult',
      aiPromptKey: 'consult_analysis',
      aiOutput: '',
      formFields: fields,
      formData: { niche: 'Spa' },
    });
    expect(result.ok).toBe(false);
    expect(result.missing_labels).toContain('AI Hỗ trợ');
  });

  it('allows consult done when AI output present', () => {
    expect(
      validatePresalesConsultTaskDone({
        stage: 'consult',
        aiPromptKey: 'consult_analysis',
        aiOutput: 'Phân tích OK',
        formFields: fields,
        formData: { niche: 'Spa' },
      }).ok,
    ).toBe(true);
  });

  it('throws via assert helper', () => {
    expect(() =>
      assertPresalesConsultTaskDone({
        stage: 'consult',
        aiPromptKey: 'consult_analysis',
        aiOutput: '',
        formFields: fields,
        formData: { niche: 'Spa' },
      }),
    ).toThrow(/AI Hỗ trợ/);
  });
});
