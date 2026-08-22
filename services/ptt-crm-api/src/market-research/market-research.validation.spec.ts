import {
  validateCreateDecision,
  validateCreateProject,
  validateCreateWave,
  validateThemeCode,
} from './market-research.validation';

const valid = {
  client_id: 'acme',
  title: 'Category review sữa uống',
  product_type: 'CAT_REVIEW',
  decision_statement: 'Quyết định có mở SKU premium Q4 hay không.',
  questions: [{ question_vi: 'Quy mô thị trường sữa uống VN?' }],
};

describe('validateCreateProject', () => {
  it('returns no messages for a valid payload', () => {
    expect(validateCreateProject(valid)).toEqual([]);
  });

  it('requires non-empty client_id', () => {
    expect(validateCreateProject({ ...valid, client_id: '  ' })).toContain('client_id is required');
  });

  it('requires product_type in PRODUCT_TYPES', () => {
    expect(validateCreateProject({ ...valid, product_type: 'UNKNOWN' })).toContain(
      'product_type is invalid',
    );
  });

  it('requires decision_statement trim length >= 20', () => {
    expect(validateCreateProject({ ...valid, decision_statement: '   quá ngắn   ' })).toContain(
      'decision_statement must be at least 20 characters',
    );
  });

  it('requires title trim length >= 8', () => {
    expect(validateCreateProject({ ...valid, title: '  short  ' })).toContain(
      'title must be at least 8 characters',
    );
  });

  it('requires at least one question with non-empty question_vi', () => {
    expect(validateCreateProject({ ...valid, questions: [] })).toContain(
      'at least one question is required',
    );
    expect(validateCreateProject({ ...valid, questions: [{ question_vi: '   ' }] })).toContain(
      'question_vi is required',
    );
  });
});

describe('validateCreateDecision', () => {
  const validDecision = {
    insight_id: 7,
    decision_text: 'Launch premium SKU in Q4 after readout',
    owner_email: 'am@ptt',
  };

  it('returns no messages for a valid payload', () => {
    expect(validateCreateDecision(validDecision)).toEqual([]);
  });

  it('rejects decision_text shorter than 10 after trim', () => {
    expect(validateCreateDecision({ ...validDecision, decision_text: 'abc' })).toContain(
      'decision_text must be at least 10 characters',
    );
  });
});

describe('validateThemeCode', () => {
  it('accepts PRICE and rejects lowercase / too-short codes', () => {
    expect(validateThemeCode('PRICE')).toBeUndefined();
    expect(validateThemeCode('price')).toBe('taxonomy_code_invalid');
    expect(validateThemeCode('P')).toBe('taxonomy_code_invalid');
  });
});

describe('validateCreateWave', () => {
  it('rejects NaN metric value', () => {
    expect(
      validateCreateWave({ wave_no: 1, metric_json: [{ key: 'nps', value: Number.NaN }] }),
    ).toContain('metric value must be number or null');
  });

  it('rejects Infinity metric value', () => {
    expect(
      validateCreateWave({ wave_no: 1, metric_json: [{ key: 'nps', value: Infinity }] }),
    ).toContain('metric value must be number or null');
  });
});
