import { BadRequestException } from '@nestjs/common';
import { AI_AUDIT_ERROR } from './ai-audit.constants';
import {
  SummarizeContext,
  SummarizeEngineResult,
  SummarizeExtracted,
  SUMMARIZE_MAX_BULLETS,
} from './summarize.types';

function asString(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  return text || null;
}

function asStringArray(value: unknown, max = 8): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item ?? '').trim())
    .filter(Boolean)
    .slice(0, max);
}

function asConfidence(value: unknown): number {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0.65;
  return Math.min(1, Math.max(0, Math.round(num * 1000) / 1000));
}

function asBudget(value: unknown): number | null {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return null;
  return Math.round(num);
}

export function emptyExtracted(): SummarizeExtracted {
  return {
    intent: null,
    objections: [],
    next_action: null,
    source: null,
    campaign_id: null,
    risk_flags: [],
    budget_vnd: null,
  };
}

export function parseExtracted(raw: unknown): SummarizeExtracted {
  const obj = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  return {
    intent: asString(obj.intent),
    objections: asStringArray(obj.objections),
    next_action: asString(obj.next_action),
    source: asString(obj.source),
    campaign_id: asString(obj.campaign_id),
    risk_flags: asStringArray(obj.risk_flags, 6),
    budget_vnd: asBudget(obj.budget_vnd ?? obj.budget),
  };
}

export function validateSummarizeOutput(
  raw: unknown,
  context: SummarizeContext,
): SummarizeEngineResult {
  const obj = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : null;
  if (!obj) {
    throw new BadRequestException({
      error: 'summarize_invalid_output',
      error_code: AI_AUDIT_ERROR.VALIDATION_ERROR,
      message: 'LLM output must be a JSON object',
    });
  }

  const summary = asString(obj.summary);
  if (!summary) {
    throw new BadRequestException({
      error: 'summarize_invalid_output',
      error_code: AI_AUDIT_ERROR.VALIDATION_ERROR,
      message: 'summary is required',
    });
  }

  let bullets = asStringArray(obj.bullets, SUMMARIZE_MAX_BULLETS);
  if (context === 'lead_brief') {
    if (bullets.length === 0) {
      bullets = summary
        .split(/\n+/)
        .map((line) => line.replace(/^[-•*]\s*/, '').trim())
        .filter(Boolean)
        .slice(0, SUMMARIZE_MAX_BULLETS);
    }
    if (bullets.length === 0) {
      bullets = [summary.slice(0, 240)];
    }
    bullets = bullets.slice(0, SUMMARIZE_MAX_BULLETS);
  }

  return {
    summary,
    bullets,
    extracted: parseExtracted(obj.extracted),
    confidence: asConfidence(obj.confidence),
  };
}
