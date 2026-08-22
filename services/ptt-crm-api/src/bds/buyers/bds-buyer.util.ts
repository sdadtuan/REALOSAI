import { BadRequestException } from '@nestjs/common';
import type { ReBuyerStatus } from './bds-buyer.types';

const RE_BUYER_FLOW = new Set(['re_buyer', 're-buyer', 'bds']);

const QUALIFY_STATUSES = new Set<ReBuyerStatus>([
  'da_lien_he',
  'xem_nha',
  'giu_cho',
  'dat_coc',
  'vbtt',
  'hdmb',
]);

function normFlow(raw: string | undefined): string {
  return String(raw ?? '')
    .trim()
    .toLowerCase();
}

export function isReBuyerFlow(leadFlowKind?: string): boolean {
  return RE_BUYER_FLOW.has(normFlow(leadFlowKind));
}

export function assertNoB2bProjectOnReBuyer(input: {
  leadFlowKind?: string;
  b2bProjectId?: string | null;
}): void {
  const flow = normFlow(input.leadFlowKind);
  const hasB2b = String(input.b2bProjectId ?? '').trim().length > 0;
  if (isReBuyerFlow(flow) && hasB2b) {
    throw new BadRequestException({ error: 'b2b_project_forbidden' });
  }
}

export function normalizeNeedJson(raw: unknown): Record<string, unknown> {
  if (raw == null) return {};
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  return {};
}

export function qualifyBuyerEligible(status: string, phone: string): boolean {
  const st = String(status ?? '')
    .trim()
    .toLowerCase() as ReBuyerStatus;
  const ph = String(phone ?? '').trim();
  return QUALIFY_STATUSES.has(st) && ph.length >= 8;
}

export function normalizePhoneE164(phone: string): string {
  const digits = String(phone ?? '').replace(/\D/g, '');
  if (digits.startsWith('84')) return digits;
  if (digits.startsWith('0')) return `84${digits.slice(1)}`;
  return digits;
}
