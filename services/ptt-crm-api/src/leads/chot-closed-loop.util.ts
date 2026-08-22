/** Phase 3 — Chốt closed-loop: parse VND/package, QA flags, playbook A/B. */

import { parseDealValueVnd } from '../performance/performance-conversion.util';

export type ChotQaFlag =
  | 'missing_deal_value'
  | 'no_call_before_chot'
  | 'missing_b2_confirmation'
  | 'weak_audit_evidence'
  | 'no_sci_before_chot';

export type CallScriptSource = 'ai_v1' | 'sop' | 'sci' | 'unknown';

export const CHOT_QA_FLAG_LABELS: Record<ChotQaFlag, string> = {
  missing_deal_value: 'Thiếu giá trị VND (ROAS)',
  no_call_before_chot: 'Chốt không có call trước đó',
  missing_b2_confirmation: 'Chưa hoàn thành B2',
  weak_audit_evidence: 'Audit note thiếu bằng chứng',
  no_sci_before_chot: 'Chốt không qua SCI (coaching — không block)',
};

const CALL_ACTIVITY_TYPES = new Set(['call', 'zalo_call', 'phone']);

export interface ChotActivitySnippet {
  activity_type: string;
  created_at?: string | null;
}

export interface ChotClosedLoopMetaPatch {
  deal_value_vnd?: number;
  chot_package?: string | null;
  closed_loop_at?: string;
  closed_loop_source?: 'audit_parse_v1';
  qa_flags?: ChotQaFlag[];
  qa_sample?: boolean;
}

export interface PlaybookAbRow {
  lead_id: number;
  call_script_source: CallScriptSource;
  deal_value_vnd: number;
  closed_within_24h: boolean;
  received_at: string | null;
  closed_at: string | null;
}

export interface PlaybookAbBucket {
  chot_count: number;
  closed_within_24h_pct: number;
  deal_value_fill_pct: number;
  avg_deal_value_vnd: number;
}

export interface PlaybookAbMetrics {
  window_days: number;
  ai_v1: PlaybookAbBucket;
  sop: PlaybookAbBucket;
  unknown: PlaybookAbBucket;
  narrative: string;
}

function parseCompactVndAmount(raw: string): number {
  const cleaned = raw.replace(/\./g, '').replace(/,/g, '.');
  const n = Number(cleaned);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
}

/** Parse giá VND từ audit note (đ, triệu, tr, k). */
export function parseChotValueFromAuditNote(note: string): number {
  const text = String(note ?? '').trim();
  if (!text) return 0;

  const trieuMatch = text.match(/(\d+(?:[.,]\d+)?)\s*(?:tr|triệu|m\b)/i);
  if (trieuMatch) {
    const base = Number(trieuMatch[1].replace(',', '.'));
    if (Number.isFinite(base) && base > 0) {
      return Math.round(base * 1_000_000);
    }
  }

  const kMatch = text.match(/(\d+(?:[.,]\d+)?)\s*k\b/i);
  if (kMatch) {
    const base = Number(kMatch[1].replace(',', '.'));
    if (Number.isFinite(base) && base > 0) {
      return Math.round(base * 1_000);
    }
  }

  const vndMatches = [...text.matchAll(/(\d[\d.,]{3,})\s*(?:đ|vnd)?/gi)];
  let best = 0;
  for (const match of vndMatches) {
    const n = parseCompactVndAmount(match[1] ?? '');
    if (n >= 10_000 && n > best) best = n;
  }
  return best;
}

/** Parse tên gói spa từ audit note. */
export function parseChotPackageFromAuditNote(note: string): string | null {
  const text = String(note ?? '').trim();
  if (!text) return null;

  const patterns = [
    /(?:gói|combo|dịch vụ)\s+([^—\n,.]{3,60})/i,
    /chốt[^—\n]*?(?:gói|combo)\s+([^—\n,.]{3,60})/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    const pkg = m?.[1]?.trim();
    if (pkg && pkg !== '…' && pkg.length >= 3) return pkg;
  }
  return null;
}

export function normalizeCallScriptSource(raw: unknown): CallScriptSource {
  const v = String(raw ?? '')
    .trim()
    .toLowerCase();
  if (v === 'sci') return 'sci';
  if (v === 'ai_v1' || v === 'ai') return 'ai_v1';
  if (v === 'sop' || v === 'manual') return 'sop';
  return 'unknown';
}

/** True when AM used SCI prep (M3 ready, script copy, or deal_room_payload). */
export function hadSciBeforeChot(input: {
  meta?: Record<string, unknown> | null;
  prepStatus?: string | null;
  prepStage?: string | null;
  hasDealRoomPayload?: boolean;
}): boolean {
  const meta = input.meta ?? {};
  const source = normalizeCallScriptSource(meta.call_script_source);
  if (source === 'sci' || source === 'ai_v1') return true;
  if (typeof meta.call_script_copied_at === 'string' && meta.call_script_copied_at.trim()) {
    return true;
  }

  const status = String(input.prepStatus ?? '')
    .trim()
    .toLowerCase();
  const stage = String(input.prepStage ?? '')
    .trim()
    .toLowerCase();
  if (status === 'ready' && stage === 'm3_pre_close') return true;
  if (input.hasDealRoomPayload) return true;

  return false;
}

export function evaluateChotQaFlags(input: {
  auditNote: string;
  dealValueVnd: number;
  activities: ChotActivitySnippet[];
  firstCallAt: string | null;
  b2CompletedAt: string | null;
  sciUsedBeforeChot?: boolean;
}): ChotQaFlag[] {
  const flags: ChotQaFlag[] = [];
  const note = String(input.auditNote ?? '').trim();

  if (input.dealValueVnd <= 0) {
    flags.push('missing_deal_value');
  }

  const hasCall =
    Boolean(input.firstCallAt) ||
    input.activities.some((a) => CALL_ACTIVITY_TYPES.has(String(a.activity_type ?? '').toLowerCase()));
  if (!hasCall) {
    flags.push('no_call_before_chot');
  }

  if (!input.b2CompletedAt) {
    flags.push('missing_b2_confirmation');
  }

  const hasPackageHint = /gói|combo|dịch vụ|triệt|facial|body/i.test(note);
  if (note.length < 15 || (!hasPackageHint && input.dealValueVnd <= 0)) {
    flags.push('weak_audit_evidence');
  }

  if (input.sciUsedBeforeChot === false) {
    flags.push('no_sci_before_chot');
  }

  return flags;
}

export function buildClosedLoopMetaPatch(input: {
  auditNote: string;
  existingMeta?: Record<string, unknown> | null;
  activities: ChotActivitySnippet[];
  firstCallAt: string | null;
  b2CompletedAt: string | null;
  sciUsedBeforeChot?: boolean;
  now?: Date;
}): ChotClosedLoopMetaPatch {
  const existing = input.existingMeta ?? {};
  const parsedValue = parseChotValueFromAuditNote(input.auditNote);
  const existingValue = parseDealValueVnd(existing);
  const dealValueVnd = parsedValue > 0 ? parsedValue : existingValue;

  const parsedPackage = parseChotPackageFromAuditNote(input.auditNote);
  const existingPackage =
    typeof existing.chot_package === 'string' ? existing.chot_package.trim() : '';
  const chotPackage = parsedPackage ?? (existingPackage || null);

  const sciUsed =
    input.sciUsedBeforeChot ??
    hadSciBeforeChot({ meta: existing });

  const qaFlags = evaluateChotQaFlags({
    auditNote: input.auditNote,
    dealValueVnd,
    activities: input.activities,
    firstCallAt: input.firstCallAt,
    b2CompletedAt: input.b2CompletedAt,
    sciUsedBeforeChot: sciUsed,
  });

  const now = (input.now ?? new Date()).toISOString();
  const patch: ChotClosedLoopMetaPatch = {
    closed_loop_at: now,
    closed_loop_source: 'audit_parse_v1',
    qa_flags: qaFlags,
    qa_sample: qaFlags.length > 0,
  };

  if (dealValueVnd > 0) patch.deal_value_vnd = dealValueVnd;
  if (chotPackage) patch.chot_package = chotPackage;

  return patch;
}

export function closedWithin24h(receivedAt: string | null, closedAt: string | null): boolean {
  if (!receivedAt || !closedAt) return false;
  const start = new Date(receivedAt);
  const end = new Date(closedAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return false;
  const hours = (end.getTime() - start.getTime()) / 3_600_000;
  return hours >= 0 && hours <= 24;
}

function summarizePlaybookBucket(rows: PlaybookAbRow[]): PlaybookAbBucket {
  const total = rows.length;
  if (!total) {
    return { chot_count: 0, closed_within_24h_pct: 0, deal_value_fill_pct: 0, avg_deal_value_vnd: 0 };
  }
  const within24 = rows.filter((r) => r.closed_within_24h).length;
  const withValue = rows.filter((r) => r.deal_value_vnd > 0).length;
  const sumValue = rows.reduce((s, r) => s + r.deal_value_vnd, 0);
  return {
    chot_count: total,
    closed_within_24h_pct: Math.round((within24 / total) * 100),
    deal_value_fill_pct: Math.round((withValue / total) * 100),
    avg_deal_value_vnd: Math.round(sumValue / total),
  };
}

export function buildPlaybookAbMetrics(rows: PlaybookAbRow[], windowDays = 30): PlaybookAbMetrics {
  const buckets: Record<CallScriptSource, PlaybookAbRow[]> = {
    ai_v1: [],
    sop: [],
    sci: [],
    unknown: [],
  };
  for (const row of rows) {
    const key = row.call_script_source === 'sci' ? 'ai_v1' : row.call_script_source;
    buckets[key].push(row);
  }

  const ai = summarizePlaybookBucket(buckets.ai_v1);
  const sop = summarizePlaybookBucket(buckets.sop);
  const unknown = summarizePlaybookBucket(buckets.unknown);

  const parts: string[] = [];
  if (ai.chot_count > 0 && sop.chot_count > 0) {
    const delta = ai.closed_within_24h_pct - sop.closed_within_24h_pct;
    parts.push(
      `AI script ${ai.closed_within_24h_pct}% chốt ≤24h vs SOP ${sop.closed_within_24h_pct}% (${delta >= 0 ? '+' : ''}${delta}pp).`,
    );
  } else if (ai.chot_count > 0) {
    parts.push(`AI script: ${ai.chot_count} chốt, ${ai.closed_within_24h_pct}% ≤24h.`);
  } else {
    parts.push('Chưa đủ dữ liệu A/B — khuyến khích CSKH copy AI script để gắn nhãn.');
  }

  return {
    window_days: windowDays,
    ai_v1: ai,
    sop,
    unknown,
    narrative: parts.join(' '),
  };
}

export const CHOT_VND_FILL_TARGET_PCT = 90;

export function buildClosedLoopDashboardSummary(input: {
  chotTotal: number;
  withDealValue: number;
  qaFlagged: number;
  dealValueSum: number;
}) {
  const total = input.chotTotal;
  const deal_value_fill_pct = total ? Math.round((input.withDealValue / total) * 100) : 0;
  return {
    chot_total: total,
    deal_value_fill_pct,
    vnd_fill_target_pct: CHOT_VND_FILL_TARGET_PCT,
    vnd_fill_gate_pass: total ? deal_value_fill_pct >= CHOT_VND_FILL_TARGET_PCT : null,
    qa_flagged_pct: total ? Math.round((input.qaFlagged / total) * 100) : 0,
    avg_deal_value_vnd: input.withDealValue ? Math.round(input.dealValueSum / input.withDealValue) : 0,
  };
}
