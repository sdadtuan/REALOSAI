import {
  allowedNextStatuses,
  computeAllowedNextStatuses,
  isCandidateStatusSelectable,
  isStatusTransitionAllowed,
  LeadStatusGateError,
  validateLeadStatusChange,
} from './lead-status-gate.util';

describe('lead-status-gate.util', () => {
  const baseCtx = {
    auditNote: 'Ghi chú audit đủ dài',
    allowOverride: false,
    overrideReason: '',
    b2Complete: true,
    hasOutreachActivity: true,
    needsCleanup: false,
    flowKind: 'spa_operational' as const,
  };

  it('blocks moi → chot (TC-LEAD-07)', () => {
    expect(isStatusTransitionAllowed('moi', 'chot')).toBe(false);
    expect(() =>
      validateLeadStatusChange({
        ...baseCtx,
        oldStatus: 'moi',
        newStatus: 'chot',
      }),
    ).toThrow(LeadStatusGateError);
  });

  it('allows moi → da_lien_he with outreach', () => {
    expect(() =>
      validateLeadStatusChange({
        ...baseCtx,
        oldStatus: 'moi',
        newStatus: 'da_lien_he',
      }),
    ).not.toThrow();
  });

  it('blocks moi → da_lien_he without outreach or B2', () => {
    expect(() =>
      validateLeadStatusChange({
        ...baseCtx,
        oldStatus: 'moi',
        newStatus: 'da_lien_he',
        hasOutreachActivity: false,
        b2Complete: false,
      }),
    ).toThrow(/activity liên hệ/);
  });

  it('requires audit note for chot', () => {
    expect(() =>
      validateLeadStatusChange({
        ...baseCtx,
        oldStatus: 'hen_gap',
        newStatus: 'chot',
        auditNote: 'ab',
      }),
    ).toThrow(/audit note/);
  });

  it('requires B2 complete for chot', () => {
    expect(() =>
      validateLeadStatusChange({
        ...baseCtx,
        oldStatus: 'hen_gap',
        newStatus: 'chot',
        b2Complete: false,
      }),
    ).toThrow(/Hoàn thành B2/);
  });

  it('allows override with reason for GDKD', () => {
    expect(() =>
      validateLeadStatusChange({
        ...baseCtx,
        oldStatus: 'moi',
        newStatus: 'chot',
        allowOverride: true,
        overrideReason: 'GDKD duyệt ngoại lệ deal hot',
        b2Complete: false,
        hasOutreachActivity: false,
        auditNote: 'Chốt ngoại lệ theo GDKD',
      }),
    ).not.toThrow();
  });

  it('lists allowed next statuses from moi', () => {
    expect(allowedNextStatuses('moi')).toEqual(['da_lien_he', 'lost', 'pending_cleanup']);
  });

  it('limits moi dropdown without outreach to lost and pending_cleanup', () => {
    const ctx = {
      currentStatus: 'moi',
      flowKind: 'spa_operational' as const,
      b2Complete: false,
      hasOutreachActivity: false,
      needsCleanup: false,
      gateEnabled: true,
    };
    expect(isCandidateStatusSelectable(ctx, 'da_lien_he')).toBe(false);
    expect(isCandidateStatusSelectable(ctx, 'lost')).toBe(true);
    const { options, hints } = computeAllowedNextStatuses(ctx);
    expect(options.map((o) => o.id)).toEqual(['moi', 'lost', 'pending_cleanup']);
    expect(hints.some((h) => h.includes('activity liên hệ'))).toBe(true);
  });

  it('allows hen_gap on spa but not won', () => {
    const ctx = {
      currentStatus: 'da_lien_he',
      flowKind: 'spa_operational' as const,
      b2Complete: true,
      hasOutreachActivity: true,
      needsCleanup: false,
      gateEnabled: true,
    };
    const { options } = computeAllowedNextStatuses(ctx);
    expect(options.map((o) => o.id)).toContain('hen_gap');
    expect(options.map((o) => o.id)).not.toContain('won');
  });

  it('blocks chot when B2 incomplete', () => {
    const ctx = {
      currentStatus: 'hen_gap',
      flowKind: 'spa_operational' as const,
      b2Complete: false,
      hasOutreachActivity: true,
      needsCleanup: false,
      gateEnabled: true,
    };
    expect(isCandidateStatusSelectable(ctx, 'chot')).toBe(false);
    const { hints } = computeAllowedNextStatuses(ctx);
    expect(hints.some((h) => h.includes('Hoàn thành B2'))).toBe(true);
  });
});
