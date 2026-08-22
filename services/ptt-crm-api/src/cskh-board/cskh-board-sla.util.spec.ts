import {
  CSKH_B2_SLA_HOURS,
  CSKH_CLOSE_SLA_HOURS,
  CSKH_FIRST_CALL_SLA_MINUTES,
  computeFirstCallSla,
  computeSpaMeta24hSlas,
  enrichSlaTierSummaries,
  enrichSlaTierSummary,
  isNewLeadStatus,
  slaTierCompliancePct,
  summarizeSlaTiers,
  tierSlaMatchesFilter,
} from './cskh-board-sla.util';

describe('cskh-board-sla.util', () => {
  const base = new Date('2026-07-26T10:00:00.000Z');

  it('isNewLeadStatus recognizes new/moi', () => {
    expect(isNewLeadStatus('new')).toBe(true);
    expect(isNewLeadStatus('moi')).toBe(true);
    expect(isNewLeadStatus('qualified')).toBe(false);
  });

  it('returns na for non-new status on first call tier', () => {
    const out = computeFirstCallSla({
      status: 'qualified',
      receivedAt: base.toISOString(),
      createdAt: base.toISOString(),
      firstCallAt: null,
      now: new Date(base.getTime() + 20 * 60_000),
    });
    expect(out.sla_state).toBe('na');
  });

  it('breach when no call after 15 minutes', () => {
    const out = computeFirstCallSla({
      status: 'new',
      receivedAt: base.toISOString(),
      createdAt: base.toISOString(),
      firstCallAt: null,
      now: new Date(base.getTime() + CSKH_FIRST_CALL_SLA_MINUTES * 60_000 + 60_000),
    });
    expect(out.sla_state).toBe('breach');
  });

  it('computes 4h B2 breach when B2 not complete', () => {
    const out = computeSpaMeta24hSlas({
      status: 'da_lien_he',
      receivedAt: base.toISOString(),
      createdAt: base.toISOString(),
      firstCallAt: new Date(base.getTime() + 10 * 60_000).toISOString(),
      careStagesDoneJson: '{}',
      now: new Date(base.getTime() + CSKH_B2_SLA_HOURS * 60 * 60_000 + 60_000),
    });
    const b2 = out.tiers.find((t) => t.tier === 'b2_complete_4h');
    expect(b2?.sla_state).toBe('breach');
  });

  it('computes 24h close breach when still open', () => {
    const out = computeSpaMeta24hSlas({
      status: 'dang_tu_van',
      receivedAt: base.toISOString(),
      createdAt: base.toISOString(),
      firstCallAt: new Date(base.getTime() + 10 * 60_000).toISOString(),
      careStagesDoneJson: JSON.stringify({ first_contact: new Date(base.getTime() + 2 * 60 * 60_000).toISOString() }),
      now: new Date(base.getTime() + CSKH_CLOSE_SLA_HOURS * 60 * 60_000 + 60_000),
    });
    const close = out.tiers.find((t) => t.tier === 'close_24h');
    expect(close?.sla_state).toBe('breach');
  });

  it('summarizes tier counts for dashboard', () => {
    const rows = [
      computeSpaMeta24hSlas({
        status: 'moi',
        receivedAt: base.toISOString(),
        createdAt: base.toISOString(),
        firstCallAt: null,
        now: new Date(base.getTime() + 20 * 60_000),
      }).tiers,
    ];
    const summary = summarizeSlaTiers(rows);
    expect(summary.first_call_15m.breach).toBeGreaterThan(0);
    expect(summary.b2_complete_4h.active).toBeGreaterThan(0);
  });

  it('filters by selected tier snapshot', () => {
    const tiers = computeSpaMeta24hSlas({
      status: 'moi',
      receivedAt: base.toISOString(),
      createdAt: base.toISOString(),
      firstCallAt: null,
      now: new Date(base.getTime() + 20 * 60_000),
    }).tiers;
    const first = tiers.find((t) => t.tier === 'first_call_15m');
    expect(tierSlaMatchesFilter(first, 'breach')).toBe(true);
    expect(tierSlaMatchesFilter(first, 'open')).toBe(false);
  });

  it('computes SLA compliance pct and pass against tier targets', () => {
    expect(slaTierCompliancePct({ ok: 17, breach: 3 })).toBe(85);
    const enriched = enrichSlaTierSummary('first_call_15m', {
      ok: 17,
      breach: 3,
      warning: 1,
      active: 21,
    });
    expect(enriched.compliance_pct).toBe(85);
    expect(enriched.target_pct).toBe(85);
    expect(enriched.compliance_pass).toBe(true);
    expect(enriched.evaluated).toBe(20);

    const fail = enrichSlaTierSummary('b2_complete_4h', { ok: 7, breach: 3, warning: 0, active: 10 });
    expect(fail.compliance_pct).toBe(70);
    expect(fail.compliance_pass).toBe(false);

    const all = enrichSlaTierSummaries({
      first_call_15m: { ok: 17, breach: 3, warning: 1, active: 21 },
      b2_complete_4h: { ok: 8, breach: 2, warning: 0, active: 10 },
      close_24h: { ok: 7, breach: 3, warning: 0, active: 10 },
    });
    expect(all.close_24h.target_pct).toBe(70);
    expect(all.close_24h.compliance_pass).toBe(true);
  });
});
