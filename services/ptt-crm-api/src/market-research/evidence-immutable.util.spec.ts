import { assertEvidenceMutable, piiHint } from './evidence-immutable.util';

describe('assertEvidenceMutable', () => {
  it('throws evidence_immutable when qcStatus is verified', () => {
    expect(() => assertEvidenceMutable('verified')).toThrow();
    try {
      assertEvidenceMutable('verified');
    } catch (err) {
      expect((err as Error & { code: string }).code).toBe('evidence_immutable');
      expect((err as Error).message).toBe('evidence_immutable');
    }
  });

  it('throws evidence_immutable when qcStatus is superseded', () => {
    expect(() => assertEvidenceMutable('superseded')).toThrow();
    try {
      assertEvidenceMutable('superseded');
    } catch (err) {
      expect((err as Error & { code: string }).code).toBe('evidence_immutable');
      expect((err as Error).message).toBe('evidence_immutable');
    }
  });

  it('throws evidence_immutable when qcStatus is rejected', () => {
    expect(() => assertEvidenceMutable('rejected')).toThrow();
    try {
      assertEvidenceMutable('rejected');
    } catch (err) {
      expect((err as Error & { code: string }).code).toBe('evidence_immutable');
      expect((err as Error).message).toBe('evidence_immutable');
    }
  });

  it('does not throw when qcStatus is pending', () => {
    expect(() => assertEvidenceMutable('pending')).not.toThrow();
  });
});

describe('piiHint', () => {
  it('returns true when excerpt contains an email', () => {
    expect(piiHint('Contact analyst@ptt.vn for the raw table')).toBe(true);
  });
});
