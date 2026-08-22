import { BadRequestException } from '@nestjs/common';
import { AI_AUDIT_ERROR } from './ai-audit.constants';

export interface FollowUpDraftEngineResult {
  draft_text: string;
  subject: string | null;
  confidence: number;
}

function asString(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  return text || null;
}

function asConfidence(value: unknown): number {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0.65;
  return Math.min(1, Math.max(0, Math.round(num * 1000) / 1000));
}

export function validateFollowUpDraftOutput(raw: unknown): FollowUpDraftEngineResult {
  const obj = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : null;
  if (!obj) {
    throw new BadRequestException({
      error: 'follow_up_invalid_output',
      error_code: AI_AUDIT_ERROR.VALIDATION_ERROR,
      message: 'LLM output must be a JSON object',
    });
  }

  const draftText = asString(obj.draft_text ?? obj.text ?? obj.message);
  if (!draftText || draftText.length < 10) {
    throw new BadRequestException({
      error: 'follow_up_invalid_output',
      error_code: AI_AUDIT_ERROR.VALIDATION_ERROR,
      message: 'draft_text must be at least 10 characters',
    });
  }

  if (draftText.length > 4000) {
    throw new BadRequestException({
      error: 'follow_up_invalid_output',
      error_code: AI_AUDIT_ERROR.VALIDATION_ERROR,
      message: 'draft_text exceeds 4000 characters',
    });
  }

  return {
    draft_text: draftText,
    subject: asString(obj.subject),
    confidence: asConfidence(obj.confidence),
  };
}
