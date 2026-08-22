/** Phase 1 — SLA-aware CSKH care helpers (Spa Meta 24h). */

import {
  CSKH_SLA_TIER_LABELS,
  computeSpaMeta24hSlas,
  isSpaClosedStatus,
  isTerminalLeadStatus,
  type CskhSlaState,
  type CskhSlaTier,
  type CskhSlaTierSnapshot,
} from '../cskh-board/cskh-board-sla.util';

export type SlaCareNbaAction = 'log_call' | 'complete_b2' | 'set_chot_audit' | 'set_lost_reason';

export interface SlaCareNba {
  action: SlaCareNbaAction;
  action_label: string;
  reason: string;
  urgency: 'normal' | 'warning' | 'breach';
  cta_target: string;
  sla_tier: CskhSlaTier | null;
}

export interface SlaCareBanner {
  severity: 'ok' | 'warning' | 'breach' | 'hidden';
  title: string;
  message: string;
  tier: CskhSlaTier | null;
}

export interface CallScriptDraft {
  greeting: string;
  intro: string;
  questions: string[];
  closing: string;
  disclaimer: string;
}

export interface LostReasonOption {
  id: string;
  label: string;
  confidence: number;
}

export interface AuditNoteDraft {
  template: string;
  hints: string[];
}

export interface SlaCareActivitySnippet {
  activity_type: string;
  content: string;
}

const LOST_REASON_CATALOG: Array<{ id: string; label: string; keywords: string[] }> = [
  { id: 'price', label: 'Giá / ngân sách không phù hợp', keywords: ['giá', 'đắt', 'budget', 'rẻ hơn', 'chi phí'] },
  { id: 'distance', label: 'Khoảng cách xa / không tiện đến', keywords: ['xa', 'khoảng cách', 'đi lại', 'ở tỉnh'] },
  { id: 'no_need', label: 'Không còn nhu cầu / đã chọn spa khác', keywords: ['không cần', 'không quan tâm', 'spa khác', 'bận'] },
  { id: 'no_answer', label: 'Không liên lạc được / không nghe máy', keywords: ['không nghe', 'tắt máy', 'không liên lạc', 'block'] },
  { id: 'schedule', label: 'Lịch không phù hợp / chưa sắp xếp được', keywords: ['lịch', 'hẹn', 'bận', 'chưa sắp'] },
  { id: 'service_mismatch', label: 'Dịch vụ không phù hợp nhu cầu', keywords: ['không phù hợp', 'khác mong muốn', 'gói'] },
];

const SLA_STATE_RANK: Record<CskhSlaState, number> = {
  na: 0,
  ok: 1,
  warning: 2,
  breach: 3,
};

function minutesRemaining(deadlineAt: string | null, now: Date): number | null {
  if (!deadlineAt) return null;
  const deadline = new Date(deadlineAt);
  if (Number.isNaN(deadline.getTime())) return null;
  return Math.round((deadline.getTime() - now.getTime()) / 60_000);
}

function formatMinutes(min: number): string {
  const abs = Math.abs(min);
  if (abs >= 60) {
    const h = Math.floor(abs / 60);
    const m = abs % 60;
    return m > 0 ? `${h}h${m}p` : `${h}h`;
  }
  return `${abs}p`;
}

function pickFocusTier(tiers: CskhSlaTierSnapshot[]): CskhSlaTierSnapshot | null {
  const active = tiers.filter((t) => t.sla_state !== 'na' && t.sla_state !== 'ok');
  if (!active.length) return null;
  return active.sort((a, b) => SLA_STATE_RANK[b.sla_state] - SLA_STATE_RANK[a.sla_state])[0] ?? null;
}

export function buildSlaCareBanner(input: {
  tiers: CskhSlaTierSnapshot[];
  worst_state: CskhSlaState;
  worst_tier: CskhSlaTier | null;
  status: string | null | undefined;
  now?: Date;
}): SlaCareBanner {
  if (isTerminalLeadStatus(input.status) || isSpaClosedStatus(input.status)) {
    return { severity: 'hidden', title: '', message: '', tier: null };
  }

  const focus = pickFocusTier(input.tiers);
  if (!focus || focus.sla_state === 'ok') {
    return { severity: 'ok', title: 'SLA ổn định', message: 'Lead đang trong SLA Spa Meta 24h.', tier: null };
  }

  const now = input.now ?? new Date();
  const remaining = minutesRemaining(focus.deadline_at, now);
  const tierLabel = CSKH_SLA_TIER_LABELS[focus.tier];
  const severity = focus.sla_state === 'breach' ? 'breach' : 'warning';

  if (focus.tier === 'first_call_15m') {
    const msg =
      remaining != null && remaining > 0
        ? `Còn ${formatMinutes(remaining)} đến deadline gọi lần đầu — ưu tiên log activity call.`
        : `Quá hạn gọi lần đầu ${focus.elapsed_minutes != null ? formatMinutes(focus.elapsed_minutes) : ''} — gọi ngay.`;
    return {
      severity,
      title: focus.sla_state === 'breach' ? 'SLA 15p — Breach' : 'SLA 15p — Sắp hết hạn',
      message: msg,
      tier: focus.tier,
    };
  }

  if (focus.tier === 'b2_complete_4h') {
    const msg =
      remaining != null && remaining > 0
        ? `Còn ${formatMinutes(remaining)} để hoàn thành B2 (Liên hệ OK).`
        : 'Quá hạn hoàn thành B2 — báo cáo Liên hệ OK và tick Hoàn thành B2.';
    return {
      severity,
      title: focus.sla_state === 'breach' ? 'SLA 4h B2 — Breach' : 'SLA 4h B2 — Sắp hết hạn',
      message: msg,
      tier: focus.tier,
    };
  }

  const msg =
    remaining != null && remaining > 0
      ? `Còn ${formatMinutes(remaining)} để chốt hoặc lost kèm audit note.`
      : 'Quá hạn 24h — chốt gói + giá VND hoặc lost + lý do.';
  return {
    severity,
    title: focus.sla_state === 'breach' ? 'SLA 24h — Breach' : 'SLA 24h — Sắp hết hạn',
    message: msg,
    tier: focus.tier,
  };
}

export function resolveSlaCareNba(input: {
  status: string | null | undefined;
  tiers: CskhSlaTierSnapshot[];
  worst_state: CskhSlaState;
  worst_tier: CskhSlaTier | null;
  now?: Date;
}): SlaCareNba | null {
  if (isTerminalLeadStatus(input.status) || isSpaClosedStatus(input.status)) {
    return null;
  }

  const focus = pickFocusTier(input.tiers);
  if (!focus) return null;

  const urgency = focus.sla_state === 'breach' ? 'breach' : focus.sla_state === 'warning' ? 'warning' : 'normal';
  if (urgency === 'normal') return null;

  const now = input.now ?? new Date();
  const remaining = minutesRemaining(focus.deadline_at, now);
  const remainText =
    remaining != null && remaining > 0 ? `Còn ${formatMinutes(remaining)}` : 'Đã quá hạn';

  if (focus.tier === 'first_call_15m') {
    return {
      action: 'log_call',
      action_label: 'Gọi ngay & log call',
      reason: `${remainText} — SLA gọi lần đầu 15p (${CSKH_SLA_TIER_LABELS.first_call_15m}).`,
      urgency,
      cta_target: '#lead-activity-form',
      sla_tier: focus.tier,
    };
  }

  if (focus.tier === 'b2_complete_4h') {
    return {
      action: 'complete_b2',
      action_label: 'Hoàn thành B2 — Liên hệ OK',
      reason: `${remainText} — SLA hoàn thành B2 trong 4h.`,
      urgency,
      cta_target: '#lead-funnel-panel',
      sla_tier: focus.tier,
    };
  }

  const status = String(input.status ?? '').toLowerCase();
  const nearClose = ['hen_gap', 'dang_tu_van', 'da_lien_he', 'qualified', 'bao_gia'].includes(status);

  if (nearClose) {
    return {
      action: 'set_chot_audit',
      action_label: 'Chốt gói + audit note',
      reason: `${remainText} — SLA 24h: chốt gói + giá VND hoặc lost có lý do.`,
      urgency,
      cta_target: '#lead-status-form',
      sla_tier: focus.tier,
    };
  }

  return {
    action: 'set_lost_reason',
    action_label: 'Cập nhật trạng thái / lost',
    reason: `${remainText} — SLA 24h: đóng lead (chốt hoặc lost) kèm audit.`,
    urgency,
    cta_target: '#lead-status-form',
    sla_tier: focus.tier,
  };
}

export function hasActiveSlaCareSignal(
  sla: ReturnType<typeof computeSpaMeta24hSlas>,
  status: string | null | undefined,
): boolean {
  return resolveSlaCareNba({ ...sla, status }) != null;
}

export function buildCallScriptDraft(input: {
  fullName: string;
  channel?: string | null;
  source?: string | null;
  spaName?: string | null;
}): CallScriptDraft {
  const name = String(input.fullName ?? '').trim() || 'chị/em';
  const spa = String(input.spaName ?? '').trim() || 'spa';
  const channel = String(input.channel ?? input.source ?? 'Meta').trim() || 'Meta';

  return {
    greeting: `Xin chào ${name}, em gọi từ ${spa} — em nhận thông tin ${name} qua ${channel}.`,
    intro:
      'Em liên hệ để xác nhận nhu cầu và tư vấn gói phù hợp. Anh/chị có 2–3 phút trao đổi được không ạ?',
    questions: [
      'Anh/chị quan tâm dịch vụ nào (triệt lông, facial, body…)?',
      'Anh/chị muốn hẹn thử / tư vấn trực tiếp ngày nào?',
      'Khu vực anh/chị ở — em sẽ gợi ý chi nhánh gần nhất.',
    ],
    closing: 'Em gửi lại thông tin gói qua Zalo/SMS. Cảm ơn anh/chị!',
    disclaimer: 'BR-AI-01: Script gợi ý — CSKH tự chỉnh trước khi gọi, không auto gửi.',
  };
}

export function suggestLostReasons(input: {
  activities: SlaCareActivitySnippet[];
  status?: string | null;
}): LostReasonOption[] {
  const corpus = input.activities
    .map((a) => `${a.activity_type} ${a.content}`.toLowerCase())
    .join(' ');

  const scored = LOST_REASON_CATALOG.map((row) => {
    let hits = 0;
    for (const kw of row.keywords) {
      if (corpus.includes(kw)) hits += 1;
    }
    const confidence = Math.min(0.92, 0.45 + hits * 0.12);
    return { id: row.id, label: row.label, confidence, hits };
  })
    .filter((r) => r.hits > 0)
    .sort((a, b) => b.confidence - a.confidence);

  if (scored.length >= 3) {
    return scored.slice(0, 5).map(({ id, label, confidence }) => ({ id, label, confidence }));
  }

  const defaults: LostReasonOption[] = [
    { id: 'price', label: LOST_REASON_CATALOG[0].label, confidence: 0.5 },
    { id: 'no_need', label: LOST_REASON_CATALOG[2].label, confidence: 0.48 },
    { id: 'no_answer', label: LOST_REASON_CATALOG[3].label, confidence: 0.46 },
    { id: 'distance', label: LOST_REASON_CATALOG[1].label, confidence: 0.44 },
    { id: 'schedule', label: LOST_REASON_CATALOG[4].label, confidence: 0.42 },
  ];

  const seen = new Set(scored.map((s) => s.id));
  for (const d of defaults) {
    if (scored.length >= 5) break;
    if (!seen.has(d.id)) {
      scored.push({ ...d, hits: 0 });
      seen.add(d.id);
    }
  }

  return (scored.length ? scored : defaults)
    .slice(0, 5)
    .map(({ id, label, confidence }) => ({ id, label, confidence }));
}

export function buildAuditNoteDraft(input: {
  activities: SlaCareActivitySnippet[];
  fullName?: string | null;
}): AuditNoteDraft {
  const notes = input.activities
    .filter((a) => ['call', 'note', 'message', 'meeting'].includes(a.activity_type))
    .map((a) => a.content.trim())
    .filter((c) => c.length >= 3);

  const lastNote = notes[0] ?? '';
  const serviceMatch = lastNote.match(/(?:gói|dịch vụ|combo)\s+([^—\n,.]{3,40})/i);
  const priceMatch = lastNote.match(/(\d[\d.,]{4,})\s*(?:đ|vnd|k)?/i);

  const service = serviceMatch?.[1]?.trim() ?? '…';
  const price = priceMatch?.[1]?.replace(/\./g, '') ?? '…';
  const name = String(input.fullName ?? '').trim() || 'khách';

  const template = `Chốt ${name} — gói ${service} — ${price} VND — lịch hẹn: …`;

  return {
    template,
    hints: [
      'Ghi rõ tên gói dịch vụ đã chốt',
      'Ghi giá VND (bắt buộc cho closed-loop ROAS)',
      'Ghi ngày/giờ hẹn nếu có',
    ],
  };
}
