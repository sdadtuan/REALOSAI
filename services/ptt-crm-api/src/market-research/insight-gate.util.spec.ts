import { assertNotSelfApprove, canApproveTarget, evaluateInsightGate } from './insight-gate.util';
import type { ConfidenceRubric } from './market-research.types';

const validRubric: ConfidenceRubric = { S: 3, F: 3, T: 3, A: 3, R: 3 };

describe('evaluateInsightGate', () => {
  it('returns missing_verified_evidence when verifiedEvidenceCount is 0', () => {
    expect(
      evaluateInsightGate({
        verifiedEvidenceCount: 0,
        confidenceRationale: 'Method OK',
        confidenceRubric: validRubric,
      }),
    ).toEqual({
      ok: false,
      error: 'insight_gate',
      messages: ['missing_verified_evidence'],
    });
  });

  it('returns missing_confidence_rationale when rationale is empty', () => {
    expect(
      evaluateInsightGate({
        verifiedEvidenceCount: 1,
        confidenceRationale: '   ',
        confidenceRubric: validRubric,
      }),
    ).toEqual({
      ok: false,
      error: 'insight_gate',
      messages: ['missing_confidence_rationale'],
    });
  });

  it('returns both codes when evidence and rationale are missing', () => {
    expect(
      evaluateInsightGate({
        verifiedEvidenceCount: 0,
        confidenceRationale: null,
        confidenceRubric: validRubric,
      }),
    ).toEqual({
      ok: false,
      error: 'insight_gate',
      messages: ['missing_verified_evidence', 'missing_confidence_rationale'],
    });
  });

  it('returns missing_confidence_rubric when 5 dims are absent', () => {
    expect(
      evaluateInsightGate({
        verifiedEvidenceCount: 1,
        confidenceRationale: 'Nguồn verified, sample 2025',
      }),
    ).toEqual({
      ok: false,
      error: 'insight_gate',
      messages: ['missing_confidence_rubric'],
    });
  });

  it('returns forbidden_confidence_wording for 95% confidence without statistical inference', () => {
    expect(
      evaluateInsightGate({
        verifiedEvidenceCount: 1,
        confidenceRationale: 'We have 95% confidence in this TAM',
        confidenceRubric: validRubric,
      }),
    ).toEqual({
      ok: false,
      error: 'insight_gate',
      messages: ['forbidden_confidence_wording'],
    });
  });

  it('returns ok when evidence, rationale, and rubric are present', () => {
    expect(
      evaluateInsightGate({
        verifiedEvidenceCount: 1,
        confidenceRationale: 'Nguồn verified, sample 2025',
        confidenceRubric: validRubric,
      }),
    ).toEqual({ ok: true });
  });
});

describe('assertNotSelfApprove', () => {
  it('throws cannot_self_approve when emails match', () => {
    expect(() => assertNotSelfApprove('a@x', 'a@x')).toThrow();
    try {
      assertNotSelfApprove('a@x', 'a@x');
    } catch (err) {
      expect((err as Error & { code: string }).code).toBe('cannot_self_approve');
      expect((err as Error).message).toBe('cannot_self_approve');
    }
  });

  it('does not throw when emails differ', () => {
    expect(() => assertNotSelfApprove('a@x', 'b@x')).not.toThrow();
  });
});

describe('canApproveTarget', () => {
  it('allows analyst_verified → approved_internal at low risk', () => {
    expect(canApproveTarget('analyst_verified', 'approved_internal', 'low')).toBe(true);
  });

  it('rejects draft → approved_internal', () => {
    expect(canApproveTarget('draft', 'approved_internal', 'low')).toBe(false);
  });

  it('allows approved_internal → approved_client_facing', () => {
    expect(canApproveTarget('approved_internal', 'approved_client_facing', 'low')).toBe(true);
  });
});
