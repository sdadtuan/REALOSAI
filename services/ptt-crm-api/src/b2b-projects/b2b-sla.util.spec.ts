import { isWithinBusinessHours, resolveSlaAction, shouldStartAiCall, slaBand } from './b2b-sla.util';

describe('b2b sla', () => {
  it('bands', () => {
    expect(slaBand(70)).toBe('hot');
    expect(slaBand(40)).toBe('warm');
    expect(slaBand(10)).toBe('cold');
  });

  it('B2B-10 hop hot at 5m without call', () => {
    expect(
      resolveSlaAction({
        score: 80,
        elapsedMin: 5,
        hopCount: 0,
        hasCallActivity: false,
        answered: false,
        inHours: true,
      }),
    ).toBe('hop');
  });

  it('B2B-11 answered blocks hop', () => {
    expect(
      resolveSlaAction({
        score: 80,
        elapsedMin: 6,
        hopCount: 0,
        hasCallActivity: false,
        answered: true,
        inHours: true,
      }),
    ).toBe('none');
  });

  it('B2B-12 third hop → gdkd_queue', () => {
    expect(
      resolveSlaAction({
        score: 80,
        elapsedMin: 5,
        hopCount: 2,
        hasCallActivity: false,
        answered: false,
        inHours: true,
      }),
    ).toBe('gdkd_queue');
  });

  it('B2B-13 warn (ai_call) at 3m hot', () => {
    expect(
      resolveSlaAction({
        score: 80,
        elapsedMin: 3,
        hopCount: 0,
        hasCallActivity: false,
        answered: false,
        inHours: true,
      }),
    ).toBe('ai_call');
  });

  it('outside hours none', () => {
    expect(
      resolveSlaAction({
        score: 80,
        elapsedMin: 10,
        hopCount: 0,
        hasCallActivity: false,
        answered: false,
        inHours: false,
      }),
    ).toBe('none');
  });

  it('business hours weekday', () => {
    const hours = { tz: 'UTC', days: [1, 2, 3, 4, 5], start: '08:00', end: '18:00' };
    const mondayMorning = new Date('2026-08-17T10:00:00Z');
    expect(isWithinBusinessHours(hours, mondayMorning)).toBe(true);
    const saturday = new Date('2026-08-15T10:00:00Z');
    expect(isWithinBusinessHours(hours, saturday)).toBe(false);
  });
});

describe('shouldStartAiCall', () => {
  it('B2B-13 no AI before warn', () => {
    expect(
      shouldStartAiCall({ action: 'none', hasStaffDialed: false, alreadyAiCalled: false, aiCallEnabled: true }),
    ).toBe(false);
  });

  it('B2B-14 AI at warn if staff not dialed', () => {
    expect(
      shouldStartAiCall({ action: 'ai_call', hasStaffDialed: false, alreadyAiCalled: false, aiCallEnabled: true }),
    ).toBe(true);
  });

  it('no AI if staff already dialed', () => {
    expect(
      shouldStartAiCall({ action: 'ai_call', hasStaffDialed: true, alreadyAiCalled: false, aiCallEnabled: true }),
    ).toBe(false);
  });

  it('no AI if DNC blocked', () => {
    expect(
      shouldStartAiCall({
        action: 'ai_call',
        hasStaffDialed: false,
        alreadyAiCalled: false,
        aiCallEnabled: true,
        dncBlocked: true,
      }),
    ).toBe(false);
  });
});
