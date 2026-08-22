import {
  buildSlaDailyDigest,
  buildTopBreachSnapshots,
  buildTriageSuggestions,
  computeRepPerformance,
  countRootCauses,
  inferBreachRootCause,
} from './cskh-manager-intelligence.util';
import type { CskhBoardRow } from './cskh-board.types';

describe('cskh-manager-intelligence.util', () => {
  const baseRow = (overrides: Partial<CskhBoardRow> = {}): CskhBoardRow => ({
    id: 1,
    full_name: 'Test',
    phone: '090',
    email: '',
    status: 'moi',
    source: 'meta',
    channel: 'meta',
    owner_id: 10,
    owner_name: 'CSKH A',
    received_at: '2026-07-26T10:00:00.000Z',
    created_at: '2026-07-26T10:00:00.000Z',
    first_call_at: null,
    b2_completed_at: null,
    closed_at: null,
    sla_state: 'breach',
    sla_tier: 'first_call_15m',
    sla_tiers: [
      {
        tier: 'first_call_15m',
        label: 'Gọi lần đầu (15p)',
        sla_state: 'breach',
        deadline_at: null,
        completed_at: null,
        elapsed_minutes: 20,
        deadline_minutes: 15,
      },
      {
        tier: 'b2_complete_4h',
        label: 'Hoàn thành B2 (4h)',
        sla_state: 'warning',
        deadline_at: null,
        completed_at: null,
        elapsed_minutes: 60,
        deadline_minutes: 240,
      },
      {
        tier: 'close_24h',
        label: 'Chốt / Lost (24h)',
        sla_state: 'ok',
        deadline_at: null,
        completed_at: null,
        elapsed_minutes: 60,
        deadline_minutes: 1440,
      },
    ],
    sla_minutes_elapsed: 20,
    sla_deadline_at: null,
    next_follow_up_at: null,
    ...overrides,
  });

  it('infers no_call root cause', () => {
    expect(inferBreachRootCause(baseRow())).toBe('no_call');
  });

  it('computes rep performance score', () => {
    const reps = computeRepPerformance([
      baseRow(),
      baseRow({ id: 2, owner_id: 10, sla_tiers: baseRow().sla_tiers }),
    ]);
    expect(reps[0]?.owner_id).toBe(10);
    expect(reps[0]?.breach_first_call).toBe(2);
    expect(reps[0]?.performance_score).toBeLessThan(100);
  });

  it('suggests triage when same rep has 2+ first call breaches', () => {
    const rows = [
      baseRow({ id: 1, owner_id: 10, owner_name: 'A' }),
      baseRow({ id: 2, owner_id: 10, owner_name: 'A' }),
      baseRow({
        id: 3,
        owner_id: 11,
        owner_name: 'B',
        first_call_at: '2026-07-26T10:05:00.000Z',
        sla_tiers: baseRow({
          first_call_at: '2026-07-26T10:05:00.000Z',
          sla_tiers: baseRow().sla_tiers.map((t) =>
            t.tier === 'first_call_15m' ? { ...t, sla_state: 'ok' as const } : t,
          ),
        }).sla_tiers,
      }),
    ];
    const reps = computeRepPerformance(rows);
    const triage = buildTriageSuggestions(rows, reps);
    expect(triage.length).toBeGreaterThan(0);
    expect(triage[0]?.lead_ids.length).toBeGreaterThanOrEqual(2);
  });

  it('builds daily digest with top breaches', () => {
    const digest = buildSlaDailyDigest({
      rows: [baseRow(), baseRow({ id: 2 })],
      tierSummary: {
        first_call_15m: { breach: 2, warning: 0, ok: 0, active: 2 },
        b2_complete_4h: { breach: 0, warning: 2, ok: 0, active: 2 },
        close_24h: { breach: 0, warning: 0, ok: 2, active: 2 },
      },
      teamAcceptancePct: 40,
    });
    expect(digest.top_breaches.length).toBeGreaterThan(0);
    expect(digest.email_preview).toContain('Top 5 breach');
    expect(countRootCauses([baseRow()]).no_call).toBe(1);
    expect(buildTopBreachSnapshots([baseRow()], 5)[0]?.lead_id).toBe(1);
  });
});
