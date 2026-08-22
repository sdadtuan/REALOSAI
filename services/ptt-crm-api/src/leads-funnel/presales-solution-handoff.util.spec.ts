import { blocksDirectProposalAdvance, handoffBadgeLabel, normalizeHandoffStatus } from './presales-solution-handoff.util';

describe('presales-solution-handoff.util', () => {
  it('normalizes handoff status', () => {
    expect(normalizeHandoffStatus('pending')).toBe('pending');
    expect(normalizeHandoffStatus('with_solution')).toBe('with_solution');
    expect(normalizeHandoffStatus('released')).toBe('released');
    expect(normalizeHandoffStatus('')).toBe('');
    expect(normalizeHandoffStatus(null)).toBe('');
  });

  it('blocks direct proposal advance for active handoff', () => {
    expect(blocksDirectProposalAdvance('pending')).toBe(true);
    expect(blocksDirectProposalAdvance('with_solution')).toBe(true);
    expect(blocksDirectProposalAdvance('released')).toBe(false);
    expect(blocksDirectProposalAdvance('')).toBe(false);
  });

  it('builds badge labels', () => {
    expect(handoffBadgeLabel('pending')).toContain('chờ');
    expect(handoffBadgeLabel('with_solution', 'Lan')).toContain('Lan');
  });
});
