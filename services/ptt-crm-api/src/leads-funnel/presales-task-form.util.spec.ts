import {
  mergePresalesFormData,
  parsePresalesFormFields,
  validatePresalesTaskFormComplete,
} from './presales-task-form.util';

describe('presales-task-form.util', () => {
  const fields = [
    { key: 'niche', label: 'Ngành KH', type: 'text' },
    { key: 'budget', label: 'Ngân sách/tháng (VND)', type: 'number' },
  ];

  it('parses workflow form_fields', () => {
    expect(parsePresalesFormFields(fields)).toHaveLength(2);
  });

  it('blocks complete when required fields empty', () => {
    const result = validatePresalesTaskFormComplete(fields, { niche: 'Spa' });
    expect(result.ok).toBe(false);
    expect(result.missing_labels).toContain('Ngân sách/tháng (VND)');
  });

  it('allows complete when all required fields filled', () => {
    const result = validatePresalesTaskFormComplete(fields, {
      niche: 'Spa',
      budget: 15000000,
    });
    expect(result.ok).toBe(true);
  });

  it('merges patch into existing form_data', () => {
    expect(
      mergePresalesFormData({ niche: 'Spa' }, { budget: 1000000 }).budget,
    ).toBe(1000000);
  });

  it('allows task with no form_fields', () => {
    expect(validatePresalesTaskFormComplete([], {}).ok).toBe(true);
  });
});
