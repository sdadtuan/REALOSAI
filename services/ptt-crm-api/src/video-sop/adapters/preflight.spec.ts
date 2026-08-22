import type { CanonicalRequest } from './i-provider';
import { ProviderError } from './provider-error';
import { assertSupported } from './preflight';

describe('assertSupported', () => {
  const baseReq: CanonicalRequest = {
    job_id: 'job-1',
    project_id: 1,
    shot_id: null,
    capability: 'VIDEO_GEN',
    provider_code: 'runway',
    model_key: 'video.runway.gen45',
    intent: 'DRAFT',
    params: { duration_sec: 10, prompt: 'hello' },
    inputs: [],
  };

  const capabilityJson = {
    capability: 'VIDEO_GEN',
    constraints: {
      duration_sec: { min: 3, max: 15 },
      prompt_max_chars: 100,
      unsupported: ['seed'],
    },
  };

  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    fetchSpy = jest.spyOn(global, 'fetch').mockImplementation(async () => {
      throw new Error('fetch must not be called during preflight');
    });
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('rejects duration outside constraint without fetching', () => {
    expect(() =>
      assertSupported(
        { ...baseReq, params: { duration_sec: 20 } },
        { capability: 'VIDEO_GEN', constraints: { duration_sec: { min: 3, max: 15 } } },
      ),
    ).toThrow(/E_CAPABILITY_UNSUPPORTED/);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('rejects prompt longer than prompt_max_chars', () => {
    expect(() =>
      assertSupported(
        { ...baseReq, params: { ...baseReq.params, prompt: 'x'.repeat(101) } },
        { capability: 'VIDEO_GEN', constraints: { prompt_max_chars: 100 } },
      ),
    ).toThrow(ProviderError);
    try {
      assertSupported(
        { ...baseReq, params: { ...baseReq.params, prompt: 'x'.repeat(101) } },
        { capability: 'VIDEO_GEN', constraints: { prompt_max_chars: 100 } },
      );
    } catch (err) {
      expect(err).toMatchObject({
        error_class: 'capability',
        message: 'E_CAPABILITY_UNSUPPORTED',
      });
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('rejects params keys listed in constraints.unsupported', () => {
    expect(() =>
      assertSupported(
        { ...baseReq, params: { ...baseReq.params, seed: 42 } },
        { capability: 'VIDEO_GEN', constraints: { unsupported: ['seed'] } },
      ),
    ).toThrow(/E_CAPABILITY_UNSUPPORTED/);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('rejects when request capability differs from capability_json', () => {
    expect(() =>
      assertSupported(
        { ...baseReq, capability: 'IMAGE_GEN' },
        { capability: 'VIDEO_GEN', constraints: {} },
      ),
    ).toThrow(/E_CAPABILITY_UNSUPPORTED/);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('passes when params satisfy all constraints', () => {
    expect(() => assertSupported(baseReq, capabilityJson)).not.toThrow();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
