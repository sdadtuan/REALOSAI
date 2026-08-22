import { pollSecFor, jitteredPollDelayMs } from './vd-poller.service';

describe('pollSecFor', () => {
  it('reads poll_sec from capability_json', () => {
    expect(pollSecFor('video.runway.gen45', { async: { poll_sec: 7 } })).toBe(7);
  });

  it('defaults runway to 5', () => {
    expect(pollSecFor('video.runway.gen4_turbo_draft')).toBe(5);
  });

  it('defaults kling to 10', () => {
    expect(pollSecFor('video.kling.v3.pro')).toBe(10);
  });

  it('defaults openai text to 2', () => {
    expect(pollSecFor('text.openai.script')).toBe(2);
  });
});

describe('jitteredPollDelayMs', () => {
  it('is at least poll_sec * 1000', () => {
    expect(jitteredPollDelayMs(5, () => 0)).toBe(5000);
  });

  it('adds up to 50% jitter', () => {
    expect(jitteredPollDelayMs(10, () => 1)).toBe(15000);
  });
});
