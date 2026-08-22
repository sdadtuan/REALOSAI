import { shouldUsePgvectorAnn, toPgvectorLiteral } from './pgvector.util';

describe('pgvector.util', () => {
  it('P20 toPgvectorLiteral formats a finite vector', () => {
    expect(toPgvectorLiteral([1, 0, -0.5])).toBe('[1,0,-0.5]');
  });

  it('P20 toPgvectorLiteral rejects empty or non-finite', () => {
    expect(() => toPgvectorLiteral([])).toThrow('invalid_pgvector');
    expect(() => toPgvectorLiteral([Number.NaN])).toThrow('invalid_pgvector');
  });

  it('P20 shouldUsePgvectorAnn requires flag, ready, and non-empty queryVec', () => {
    expect(shouldUsePgvectorAnn(false, true, [1, 0])).toBe(false);
    expect(shouldUsePgvectorAnn(true, true, undefined)).toBe(false);
    expect(shouldUsePgvectorAnn(true, true, [])).toBe(false);
    expect(shouldUsePgvectorAnn(true, true, [0.1, 0.2])).toBe(true);
  });

  it('P28 shouldUsePgvectorAnn false when flag on but pgvector not ready', () => {
    expect(shouldUsePgvectorAnn(true, false, [0.1, 0.2])).toBe(false);
  });
});
