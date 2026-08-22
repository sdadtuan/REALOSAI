import {
  buildLeonardoV2Body,
  LeonardoImageGen,
  mapCharacterStrength,
  mapLeonardoPoll,
} from './leonardo.image';

describe('mapLeonardoPoll', () => {
  it('maps complete empty images to not_ready', () => {
    expect(
      mapLeonardoPoll({ generations_by_pk: { status: 'COMPLETE', generated_images: [] } }),
    ).toEqual({
      status: 'running',
      error_class: 'not_ready',
    });
  });

  it('maps complete with image to succeeded', () => {
    expect(
      mapLeonardoPoll({
        generations_by_pk: {
          status: 'COMPLETE',
          generated_images: [{ url: 'https://cdn.example/a.png' }],
        },
      }),
    ).toEqual({
      status: 'succeeded',
      url: 'https://cdn.example/a.png',
    });
  });
});

describe('mapCharacterStrength', () => {
  it('maps ULTRA to HIGH with warning', () => {
    expect(mapCharacterStrength('ULTRA')).toEqual({
      strength: 'HIGH',
      warning: 'character_strength_ULTRA_mapped_to_HIGH',
    });
  });

  it('maps MAX to HIGH with warning', () => {
    expect(mapCharacterStrength('MAX')).toEqual({
      strength: 'HIGH',
      warning: 'character_strength_MAX_mapped_to_HIGH',
    });
  });

  it('passes through HIGH unchanged', () => {
    expect(mapCharacterStrength('HIGH')).toEqual({ strength: 'HIGH' });
  });
});

describe('buildLeonardoV2Body', () => {
  it('uses lucid-origin model by default', () => {
    const body = buildLeonardoV2Body({ prompt: 'x', width: 1024, height: 768 });
    expect(body.model).toBe('lucid-origin');
    expect(body.parameters.prompt).toBe('x');
  });

  it('includes guidances with mapped strength', () => {
    const body = buildLeonardoV2Body(
      {
        prompt: 'x',
        width: 1024,
        height: 768,
        guidances: { character_id: 'char-1', character_strength: 'ULTRA' },
      },
      'lucid-origin',
    );
    expect(body.parameters.guidances).toEqual({
      character_id: 'char-1',
      character_strength: 'HIGH',
    });
    expect(body.warnings).toContain('character_strength_ULTRA_mapped_to_HIGH');
  });
});

describe('LeonardoImageGen HTTP mapping', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('maps 429 to rate_limit without parsing JSON', async () => {
    const json = jest.fn();
    global.fetch = jest.fn().mockResolvedValue({
      status: 429,
      ok: false,
      json,
    } as unknown as Response);

    const gen = new LeonardoImageGen('key');
    await expect(gen.generate({ prompt: 'x', width: 1, height: 1 })).rejects.toMatchObject({
      error_class: 'rate_limit',
    });
    expect(json).not.toHaveBeenCalled();
  });

  it('posts v2 generations by default', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ generationId: 'gen-v2' }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          generations_by_pk: {
            status: 'COMPLETE',
            generated_images: [{ url: 'https://cdn.example/a.png' }],
          },
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
      } as Response);

    global.fetch = fetchMock;
    const gen = new LeonardoImageGen('key');
    const result = await gen.generate({ prompt: 'x', width: 1024, height: 768 });
    expect(result.providerId).toBe('gen-v2');
    expect(fetchMock.mock.calls[0][0]).toBe('https://cloud.leonardo.ai/api/rest/v2/generations');
  });
});
