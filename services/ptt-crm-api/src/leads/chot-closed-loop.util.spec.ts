import {
  buildClosedLoopMetaPatch,
  buildClosedLoopDashboardSummary,
  buildPlaybookAbMetrics,
  evaluateChotQaFlags,
  normalizeCallScriptSource,
  parseChotPackageFromAuditNote,
  parseChotValueFromAuditNote,
  closedWithin24h,
} from './chot-closed-loop.util';

describe('chot-closed-loop.util', () => {
  it('parseChotValueFromAuditNote reads dotted VND and triệu', () => {
    expect(parseChotValueFromAuditNote('Chốt gói triệt — 8.200.000 VND')).toBe(8_200_000);
    expect(parseChotValueFromAuditNote('Gói 7.2tr — hẹn thứ 6')).toBe(7_200_000);
    expect(parseChotValueFromAuditNote('Combo 500k')).toBe(500_000);
  });

  it('parseChotPackageFromAuditNote extracts package name', () => {
    expect(parseChotPackageFromAuditNote('Chốt Lan — gói triệt nách 8 buổi — 3.5tr')).toBe(
      'triệt nách 8 buổi',
    );
  });

  it('evaluateChotQaFlags flags missing value and no call', () => {
    const flags = evaluateChotQaFlags({
      auditNote: 'ok',
      dealValueVnd: 0,
      activities: [{ activity_type: 'note' }],
      firstCallAt: null,
      b2CompletedAt: null,
    });
    expect(flags).toContain('missing_deal_value');
    expect(flags).toContain('no_call_before_chot');
    expect(flags).toContain('missing_b2_confirmation');
    expect(flags).toContain('weak_audit_evidence');
  });

  it('buildClosedLoopMetaPatch merges parsed value into meta patch', () => {
    const patch = buildClosedLoopMetaPatch({
      auditNote: 'Chốt Mai — gói facial cơ bản — 1.500.000 đ',
      existingMeta: { call_script_source: 'sci' },
      activities: [{ activity_type: 'call' }],
      firstCallAt: '2026-08-01T10:00:00Z',
      b2CompletedAt: '2026-08-01T11:00:00Z',
      now: new Date('2026-08-01T12:00:00Z'),
    });
    expect(patch.deal_value_vnd).toBe(1_500_000);
    expect(patch.chot_package).toBe('facial cơ bản');
    expect(patch.qa_flags).toEqual([]);
    expect(patch.qa_sample).toBe(false);
  });

  it('buildPlaybookAbMetrics compares ai vs sop', () => {
    const metrics = buildPlaybookAbMetrics([
      {
        lead_id: 1,
        call_script_source: 'ai_v1',
        deal_value_vnd: 2_000_000,
        closed_within_24h: true,
        received_at: '2026-08-01T08:00:00Z',
        closed_at: '2026-08-01T20:00:00Z',
      },
      {
        lead_id: 2,
        call_script_source: 'sop',
        deal_value_vnd: 0,
        closed_within_24h: false,
        received_at: '2026-08-01T08:00:00Z',
        closed_at: '2026-08-03T08:00:00Z',
      },
    ]);
    expect(metrics.ai_v1.chot_count).toBe(1);
    expect(metrics.ai_v1.closed_within_24h_pct).toBe(100);
    expect(metrics.sop.closed_within_24h_pct).toBe(0);
    expect(metrics.narrative).toContain('AI script');
  });

  it('normalizeCallScriptSource maps aliases', () => {
    expect(normalizeCallScriptSource('sci')).toBe('sci');
    expect(normalizeCallScriptSource('ai_v1')).toBe('ai_v1');
    expect(normalizeCallScriptSource('manual')).toBe('sop');
    expect(normalizeCallScriptSource('')).toBe('unknown');
  });

  it('evaluateChotQaFlags adds no_sci_before_chot when SCI not used', () => {
    const flags = evaluateChotQaFlags({
      auditNote: 'Chốt Lan — gói facial — 2tr',
      dealValueVnd: 2_000_000,
      activities: [{ activity_type: 'call' }],
      firstCallAt: '2026-08-01T10:00:00Z',
      b2CompletedAt: '2026-08-01T11:00:00Z',
      sciUsedBeforeChot: false,
    });
    expect(flags).toContain('no_sci_before_chot');
    expect(flags).not.toContain('missing_deal_value');
  });

  it('closedWithin24h respects 24h window', () => {
    expect(
      closedWithin24h('2026-08-01T08:00:00Z', '2026-08-01T20:00:00Z'),
    ).toBe(true);
    expect(
      closedWithin24h('2026-08-01T08:00:00Z', '2026-08-03T08:00:00Z'),
    ).toBe(false);
  });

  it('buildClosedLoopDashboardSummary computes fill rates', () => {
    const summary = buildClosedLoopDashboardSummary({
      chotTotal: 10,
      withDealValue: 8,
      qaFlagged: 3,
      dealValueSum: 16_000_000,
    });
    expect(summary.deal_value_fill_pct).toBe(80);
    expect(summary.vnd_fill_target_pct).toBe(90);
    expect(summary.vnd_fill_gate_pass).toBe(false);
    expect(summary.qa_flagged_pct).toBe(30);
    expect(summary.avg_deal_value_vnd).toBe(2_000_000);
  });
});
