import { ProviderError } from './provider-error';
import { getModel } from './i-provider';

describe('getModel', () => {
  const registry = [
    { code: 'video.runway.gen45', capability_json: { status: 'ACTIVE', capability: 'VIDEO_GEN' } },
    { code: 'old.model', capability_json: { status: 'DISABLED' } },
  ];

  it('returns capability_json for an active model', () => {
    const row = getModel(registry, 'video.runway.gen45');
    expect(row.code).toBe('video.runway.gen45');
    expect(row.capability_json).toEqual({ status: 'ACTIVE', capability: 'VIDEO_GEN' });
  });

  it('throws capability when model_key is missing', () => {
    expect(() => getModel(registry, 'missing.model')).toThrow(ProviderError);
    try {
      getModel(registry, 'missing.model');
    } catch (err) {
      expect(err).toMatchObject({ error_class: 'capability', message: 'E_MODEL_NOT_FOUND' });
    }
  });

  it('throws capability when model is DISABLED', () => {
    expect(() => getModel(registry, 'old.model')).toThrow(ProviderError);
    try {
      getModel(registry, 'old.model');
    } catch (err) {
      expect(err).toMatchObject({ error_class: 'capability', message: 'E_MODEL_DISABLED' });
    }
  });
});
