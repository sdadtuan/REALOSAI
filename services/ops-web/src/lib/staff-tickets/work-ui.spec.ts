import { describe, expect, it } from 'vitest';
import { slaVisual, ticketErrorMessage } from './work-ui';

describe('work-ui', () => {
  it('artifact toast copy', () => {
    expect(ticketErrorMessage('artifact').title).toContain('hồ sơ');
    expect(ticketErrorMessage('system_only').title).toContain('HĐMB');
  });

  it('slaVisual breached', () => {
    const v = slaVisual({
      id: '1',
      number: 'T-1',
      kind: 'cross',
      queue_code: 'vbtt_check',
      title: 'x',
      body: '',
      status: 'in_progress',
      priority: 'p2',
      sla_due_at: null,
      sla_breached: true,
    });
    expect(v.tone).toBe('error');
    expect(v.pct).toBe(100);
  });
});
