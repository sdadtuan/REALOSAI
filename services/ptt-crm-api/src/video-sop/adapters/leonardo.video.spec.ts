import { assertKlingViaLeonardoInput, buildLeonardoKlingBody, LeonardoVideoGen } from './leonardo.video';
import { ProviderError } from './provider-error';

describe('assertKlingViaLeonardoInput', () => {
  const base = {
    imageUrl: 'https://img/x.jpg',
    prompt: 'hello',
    durationSec: 5,
  };

  it('end_frame without start_frame throws capability', () => {
    expect(() =>
      assertKlingViaLeonardoInput({
        ...base,
        guidances: { end_frame: 'https://end.jpg' },
      }),
    ).toThrow(ProviderError);
  });

  it('rejects duration below 3', () => {
    expect(() => assertKlingViaLeonardoInput({ ...base, durationSec: 2 })).toThrow(ProviderError);
  });
});

describe('buildLeonardoKlingBody', () => {
  it('uses kling-3.0 model', () => {
    const body = buildLeonardoKlingBody({
      imageUrl: 'https://img/x.jpg',
      prompt: 'p',
      durationSec: 5,
    });
    expect(body.model).toBe('kling-3.0');
    expect(body.parameters.prompt).toBe('p');
  });

  it('includes audio flags when enabled', () => {
    const body = buildLeonardoKlingBody({
      imageUrl: 'https://img/x.jpg',
      prompt: 'p',
      durationSec: 5,
      audio_enabled: true,
    });
    expect(body.parameters.enable_audio).toBe(true);
    expect(body.parameters.motion_has_audio).toBe(true);
  });
});
