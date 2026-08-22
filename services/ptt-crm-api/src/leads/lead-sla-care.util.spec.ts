import {
  buildAuditNoteDraft,
  buildCallScriptDraft,
  buildSlaCareBanner,
  hasActiveSlaCareSignal,
  resolveSlaCareNba,
  suggestLostReasons,
} from './lead-sla-care.util';
import { computeSpaMeta24hSlas } from '../cskh-board/cskh-board-sla.util';

describe('lead-sla-care.util', () => {
  const base = new Date('2026-07-26T10:00:00.000Z');

  it('builds breach banner for first call tier', () => {
    const sla = computeSpaMeta24hSlas({
      status: 'moi',
      receivedAt: base.toISOString(),
      createdAt: base.toISOString(),
      firstCallAt: null,
      now: new Date(base.getTime() + 20 * 60_000),
    });
    const banner = buildSlaCareBanner({
      tiers: sla.tiers,
      worst_state: sla.worst_state,
      worst_tier: sla.worst_tier,
      status: 'moi',
      now: new Date(base.getTime() + 20 * 60_000),
    });
    expect(banner.severity).toBe('breach');
    expect(banner.tier).toBe('first_call_15m');
  });

  it('resolves log_call NBA for first call breach', () => {
    const sla = computeSpaMeta24hSlas({
      status: 'moi',
      receivedAt: base.toISOString(),
      createdAt: base.toISOString(),
      firstCallAt: null,
      now: new Date(base.getTime() + 20 * 60_000),
    });
    const nba = resolveSlaCareNba({ ...sla, status: 'moi', now: new Date(base.getTime() + 20 * 60_000) });
    expect(nba?.action).toBe('log_call');
    expect(nba?.urgency).toBe('breach');
  });

  it('resolves complete_b2 NBA for B2 breach', () => {
    const sla = computeSpaMeta24hSlas({
      status: 'da_lien_he',
      receivedAt: base.toISOString(),
      createdAt: base.toISOString(),
      firstCallAt: new Date(base.getTime() + 10 * 60_000).toISOString(),
      careStagesDoneJson: '{}',
      now: new Date(base.getTime() + 5 * 60 * 60_000),
    });
    const nba = resolveSlaCareNba({ ...sla, status: 'da_lien_he', now: new Date(base.getTime() + 5 * 60 * 60_000) });
    expect(nba?.action).toBe('complete_b2');
    expect(nba?.cta_target).toBe('#lead-funnel-panel');
  });

  it('hasActiveSlaCareSignal true when warning/breach', () => {
    const sla = computeSpaMeta24hSlas({
      status: 'moi',
      receivedAt: base.toISOString(),
      createdAt: base.toISOString(),
      firstCallAt: null,
      now: new Date(base.getTime() + 12 * 60_000),
    });
    expect(hasActiveSlaCareSignal(sla, 'moi')).toBe(true);
  });

  it('buildCallScriptDraft includes name and disclaimer', () => {
    const draft = buildCallScriptDraft({ fullName: 'Lan Anh', channel: 'meta' });
    expect(draft.greeting).toContain('Lan Anh');
    expect(draft.disclaimer).toContain('BR-AI-01');
    expect(draft.questions.length).toBeGreaterThanOrEqual(3);
  });

  it('suggestLostReasons matches keywords in activities', () => {
    const options = suggestLostReasons({
      activities: [{ activity_type: 'call', content: 'Khách báo giá cao hơn spa khác' }],
    });
    expect(options[0]?.id).toBe('price');
  });

  it('buildAuditNoteDraft extracts service hint', () => {
    const draft = buildAuditNoteDraft({
      fullName: 'Test',
      activities: [{ activity_type: 'note', content: 'Chốt gói Triệt lông full — 2.500.000 VND' }],
    });
    expect(draft.template).toContain('Triệt lông full');
    expect(draft.hints.length).toBeGreaterThan(0);
  });
});
