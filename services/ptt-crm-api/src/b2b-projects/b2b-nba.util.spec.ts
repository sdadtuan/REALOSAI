import { resolveB2bNba } from './b2b-nba.util';

describe('resolveB2bNba', () => {
  it('returns call when no call activity and SLA is warning', () => {
    const nba = resolveB2bNba({
      score: 80,
      slaState: 'warning',
      elapsedMin: 3.5,
      hasCall: false,
      hasNote: false,
      hasMeeting: false,
      inHours: true,
    });
    expect(nba?.action).toBe('call');
    expect(nba?.label_vi).toMatch(/Gọi ngay/);
  });

  it('returns note after call without note', () => {
    const nba = resolveB2bNba({
      score: 80,
      slaState: 'ok',
      elapsedMin: 1,
      hasCall: true,
      hasNote: false,
      hasMeeting: false,
      inHours: true,
    });
    expect(nba?.action).toBe('note');
  });

  it('returns null outside business hours', () => {
    expect(
      resolveB2bNba({
        score: 80,
        slaState: 'warning',
        elapsedMin: 4,
        hasCall: false,
        hasNote: false,
        hasMeeting: false,
        inHours: false,
      }),
    ).toBeNull();
  });
});
