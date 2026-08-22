import { BadRequestException } from '@nestjs/common';
import { CMKT_REVIEW_SLA_HOURS } from './content-marketing.constants';
import type { CmktBodyJson } from './content-marketing.types';

export const CMKT_SUBMIT_REVIEW_FROM = ['draft', 'changes_requested'] as const;
export const CMKT_APPROVE_REJECT_FROM = ['in_review'] as const;
export const CMKT_SUBMIT_CLIENT_FROM = ['approved_internal'] as const;
export const CMKT_CLIENT_DECIDE_FROM = ['pending_client'] as const;
export const CMKT_PUBLISH_FROM = ['approved_internal', 'scheduled'] as const;
export const CMKT_SCHEDULE_FROM = ['approved_internal'] as const;

export function publishFromStatuses(clientGate: boolean): readonly string[] {
  return clientGate ? ['scheduled'] : CMKT_PUBLISH_FROM;
}

export function scheduleFromStatuses(clientGate: boolean): readonly string[] {
  return clientGate ? ['client_approved'] : CMKT_SCHEDULE_FROM;
}

export function assertBodyNonEmpty(bodyJson: CmktBodyJson | undefined): void {
  const md = String(bodyJson?.markdown ?? '').trim();
  if (!md) {
    throw new BadRequestException({ error: 'body_required', message: 'Nội dung body không được trống.' });
  }
}

export function assertTransition(from: string, allowed: readonly string[], action: string): void {
  if (!allowed.includes(from)) {
    throw new BadRequestException({
      error: 'invalid_transition',
      action,
      from,
      allowed: [...allowed],
    });
  }
}

export function isReviewSlaBreach(inReviewAt: string | null, hours = CMKT_REVIEW_SLA_HOURS): boolean {
  if (!inReviewAt) return false;
  const elapsedMs = Date.now() - new Date(inReviewAt).getTime();
  return elapsedMs > hours * 3600 * 1000;
}

export function assertRejectComment(comment: unknown): string {
  const text = String(comment ?? '').trim();
  if (text.length < 10) {
    throw new BadRequestException({
      error: 'reject_comment_required',
      message: 'Comment từ chối tối thiểu 10 ký tự.',
      min_length: 10,
    });
  }
  return text;
}
