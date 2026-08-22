import { pickTopazDownloadUrl, TopazEnhance } from './topaz.enhance';
import { ProviderError } from './provider-error';

describe('pickTopazDownloadUrl', () => {
  it('prefers download_url over url', () => {
    expect(
      pickTopazDownloadUrl({
        download_url: 'https://cdn/a.png',
        url: 'https://cdn/b.png',
      }),
    ).toBe('https://cdn/a.png');
  });

  it('falls back to url with warning', () => {
    const warnings: string[] = [];
    expect(
      pickTopazDownloadUrl({ url: 'https://cdn/b.png' }, (msg) => warnings.push(msg)),
    ).toBe('https://cdn/b.png');
    expect(warnings).toContain('topaz_download_url_fallback');
  });

  it('returns null when both missing', () => {
    expect(pickTopazDownloadUrl({})).toBeNull();
  });
});

describe('TopazEnhance stub mode', () => {
  afterEach(() => {
    delete process.env.PTT_VD_PROVIDER_STUB;
  });

  it('returns stub buffer when PTT_VD_PROVIDER_STUB=1', async () => {
    process.env.PTT_VD_PROVIDER_STUB = '1';
    const gen = new TopazEnhance('key');
    const result = await gen.enhance('/tmp/in.png');
    expect(result.buffer.toString()).toContain('vd-s8-topaz-stub');
  });

  it('throws auth when key missing', async () => {
    const gen = new TopazEnhance('');
    await expect(gen.enhance('/tmp/in.png')).rejects.toMatchObject({ error_class: 'auth' });
  });
});

describe('TopazEnhance live poll', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    delete process.env.PTT_VD_PROVIDER_STUB;
  });

  it('maps 402 to budget on submit', async () => {
    process.env.PTT_VD_PROVIDER_STUB = '0';
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 402,
    } as Response);
    const gen = new TopazEnhance('key');
    await expect(gen.submitImageAsync('/in.png')).rejects.toEqual(new ProviderError('budget', 'topaz_402'));
  });
});
