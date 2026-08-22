import {
  assertNoFakeConfidence,
  buildConfidenceJson,
} from './confidence-rubric.util';

describe('buildConfidenceJson', () => {
  it('scores all-4 rubric as 4 with band very_high', () => {
    const json = buildConfidenceJson({
      rubric: { S: 4, F: 4, T: 4, A: 4, R: 4 },
    });
    expect(json.score).toBe(4);
    expect(json.band).toBe('very_high');
  });

  it('caps single-source score 3.2 to band medium', () => {
    const json = buildConfidenceJson({
      rubric: { S: 4, F: 2, T: 4, A: 3, R: 2 },
      single_source: true,
    });
    expect(json.score).toBe(3.2);
    expect(json.band).toBe('medium');
  });
});

describe('assertNoFakeConfidence', () => {
  it('throws forbidden_confidence_wording for 95% confidence when not statistical inference', () => {
    expect(() => assertNoFakeConfidence('95% confidence', false)).toThrow('forbidden_confidence_wording');
    try {
      assertNoFakeConfidence('95% confidence', false);
    } catch (err) {
      expect((err as Error & { code: string }).code).toBe('forbidden_confidence_wording');
    }
  });
});
