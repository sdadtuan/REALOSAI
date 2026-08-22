import { assertNoFakeConfidence } from './confidence-rubric.util';
import type { InsightGateCode, InsightStatus } from './market-research.constants';
import { RUBRIC_DIMS, type ConfidenceRubric } from './market-research.types';

export function isCompleteRubric(raw: unknown): raw is ConfidenceRubric {
  if (!raw || typeof raw !== 'object') return false;
  const obj = raw as Record<string, unknown>;
  return RUBRIC_DIMS.every((dim) => {
    const v = Number(obj[dim]);
    return Number.isFinite(v) && v >= 0 && v <= 4;
  });
}

export function extractRubric(raw: unknown): ConfidenceRubric | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const candidate = obj.rubric && typeof obj.rubric === 'object' ? obj.rubric : obj;
  return isCompleteRubric(candidate) ? candidate : null;
}

export function evaluateInsightGate(input: {
  verifiedEvidenceCount: number;
  confidenceRationale: string | null | undefined;
  confidenceRubric?: ConfidenceRubric | null;
}): { ok: true } | { ok: false; error: 'insight_gate'; messages: InsightGateCode[] } {
  const messages: InsightGateCode[] = [];
  if (input.verifiedEvidenceCount < 1) messages.push('missing_verified_evidence');
  if (!String(input.confidenceRationale || '').trim()) messages.push('missing_confidence_rationale');
  if (!isCompleteRubric(input.confidenceRubric)) messages.push('missing_confidence_rubric');
  if (isCompleteRubric(input.confidenceRubric)) {
    try {
      assertNoFakeConfidence(
        String(input.confidenceRationale || ''),
        Boolean(input.confidenceRubric.statistical_inference),
      );
    } catch (err) {
      if ((err as Error & { code?: string }).code === 'forbidden_confidence_wording') {
        messages.push('forbidden_confidence_wording');
      } else {
        throw err;
      }
    }
  }
  if (messages.length) return { ok: false, error: 'insight_gate', messages };
  return { ok: true };
}

export function assertNotSelfApprove(createdBy: string | null, reviewer: string): void {
  if (createdBy && createdBy.trim().toLowerCase() === reviewer.trim().toLowerCase()) {
    const err = new Error('cannot_self_approve');
    (err as Error & { code: string }).code = 'cannot_self_approve';
    throw err;
  }
}

export function canApproveTarget(
  from: InsightStatus,
  target: InsightStatus,
  riskClass: string,
): boolean {
  void riskClass;
  if (target === 'approved_internal') {
    return from === 'analyst_verified' || from === 'peer_reviewed';
  }
  if (target === 'approved_client_facing') return from === 'approved_internal';
  if (target === 'rejected') return true;
  return false;
}
