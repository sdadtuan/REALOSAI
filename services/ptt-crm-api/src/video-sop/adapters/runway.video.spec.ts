import {
  canCancelRunwayTask,
  estimateRunwayCredits,
  mapRunwayPoll,
  RunwayVideoGen,
} from './runway.video';
import { ProviderError } from './provider-error';

describe('estimateRunwayCredits', () => {
  it('uses min_charge when higher than rate*duration', () => {
    expect(estimateRunwayCredits({ rate: 28, duration_sec: 1, min_charge: 56 })).toBe(56);
  });

  it('uses rate*duration when above min_charge', () => {
    expect(estimateRunwayCredits({ rate: 5, duration_sec: 10, min_charge: 40 })).toBe(50);
  });
});

describe('canCancelRunwayTask', () => {
  it('allows cancel for RUNNING', () => {
    expect(canCancelRunwayTask('RUNNING')).toBe(true);
  });

  it('blocks cancel after SUCCEEDED', () => {
    expect(canCancelRunwayTask('SUCCEEDED')).toBe(false);
  });
});

describe('mapRunwayPoll', () => {
  it('maps SAFETY failure to moderation', () => {
    expect(
      mapRunwayPoll({ status: 'FAILED', failure: { code: 'SAFETY.INPUT.1' } }),
    ).toMatchObject({ error_class: 'moderation' });
  });

  it('maps succeeded without url to expired', () => {
    expect(mapRunwayPoll({ status: 'SUCCEEDED', output: [] })).toMatchObject({ status: 'expired' });
  });
});

describe('RunwayVideoGen.cancelRunwayTask', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    delete process.env.PTT_VD_PROVIDER_STUB;
  });

  it('DELETE blocked after SUCCEEDED without fetch', async () => {
    process.env.PTT_VD_PROVIDER_STUB = '0';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ status: 'SUCCEEDED', output: [{ url: 'https://cdn/x.mp4' }] }),
    } as Response);

    const gen = new RunwayVideoGen('key');
    await expect(gen.cancelRunwayTask('task-1')).rejects.toEqual(
      new ProviderError('capability', 'E_CANCEL_AFTER_SUCCEEDED'),
    );
  });
});

describe('RunwayVideoGen live vs stub', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    delete process.env.PTT_VD_PROVIDER_STUB;
  });

  it('uses stub buffer when PTT_VD_PROVIDER_STUB=1', async () => {
    process.env.PTT_VD_PROVIDER_STUB = '1';
    const gen = new RunwayVideoGen('key');
    const enq = await gen.enqueue({
      imageUrl: 'https://img/x.jpg',
      prompt: 'p',
      durationSec: 5,
    });
    const polled = await gen.poll(enq.providerJobId);
    expect(polled).not.toBe('running');
    if (polled !== 'running') {
      expect(polled.buffer.toString()).toContain('vd-s6-runway-stub');
    }
  });
});
