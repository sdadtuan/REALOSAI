import type { CskhBoardRow } from './cskh-board.types';
import {
  classifySlaPredictRisk,
  filterPredictionsByOwner,
  filterPredictionsForAlerts,
  predictSlaRisk,
  slaPredictAlertHash,
} from './sla-predict.util';

describe('sla-predict.util', () => {
  const now = new Date('2026-08-04T10:00:00.000Z');

  it('classifies imminent/high/medium windows', () => {
    expect(classifySlaPredictRisk(4)).toBe('imminent');
    expect(classifySlaPredictRisk(10)).toBe('high');
    expect(classifySlaPredictRisk(20)).toBe('medium');
    expect(classifySlaPredictRisk(25)).toBeNull();
    expect(classifySlaPredictRisk(0)).toBeNull();
  });

  it('predicts warning tier nearing deadline', () => {
    const deadline = new Date(now.getTime() + 8 * 60_000).toISOString();
    const rows = predictSlaRisk(
      {
        id: 42,
        full_name: 'Lan Spa',
        owner_id: 7,
        sla_tiers: [
          {
            tier: 'first_call_15m',
            sla_state: 'warning',
            deadline_at: deadline,
            label: 'Gọi lần đầu (15p)',
            completed_at: null,
            elapsed_minutes: 7,
            deadline_minutes: 15,
          },
        ],
      } as unknown as CskhBoardRow,
      now,
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]?.risk).toBe('high');
    expect(rows[0]?.suggested_action).toBe('log_call');
    expect(rows[0]?.minutes_remaining).toBe(8);
  });

  it('ignores non-warning tiers', () => {
    const rows = predictSlaRisk(
      {
        id: 1,
        sla_tiers: [{ tier: 'first_call_15m', sla_state: 'ok', deadline_at: null }],
      } as unknown as CskhBoardRow,
      now,
    );
    expect(rows).toHaveLength(0);
  });

  it('filters by owner and alert severity', () => {
    const sample = [
      {
        lead_id: 1,
        owner_id: 7,
        risk: 'high' as const,
        tier: 'first_call_15m' as const,
        minutes_remaining: 8,
      },
      {
        lead_id: 2,
        owner_id: 8,
        risk: 'medium' as const,
        tier: 'b2_complete_4h' as const,
        minutes_remaining: 18,
      },
      {
        lead_id: 3,
        owner_id: 7,
        risk: 'imminent' as const,
        tier: 'close_24h' as const,
        minutes_remaining: 4,
      },
    ];

    expect(filterPredictionsByOwner(sample as never, 7)).toHaveLength(2);
    expect(filterPredictionsForAlerts(sample as never)).toHaveLength(2);
    expect(slaPredictAlertHash(sample as never)).toContain('1:first_call_15m:high');
  });
});
