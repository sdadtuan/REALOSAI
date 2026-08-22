import { deliver } from './asset-delivery';

describe('AssetDeliveryService', () => {
  it('rejects runway octet-stream', async () => {
    await expect(
      deliver({
        provider_code: 'runway',
        role: 'start_frame',
        url: 'https://cdn.example/a',
        contentType: 'application/octet-stream',
      }),
    ).rejects.toMatchObject({ error_class: 'input_asset' });
  });

  it('returns URL delivery for runway with image/jpeg', async () => {
    const url = 'https://cdn.example/a.jpg';
    await expect(
      deliver({
        provider_code: 'runway',
        role: 'start_frame',
        url,
        contentType: 'image/jpeg',
      }),
    ).resolves.toEqual({ delivery: 'URL', ref: url });
  });

  it('returns UPLOAD pending ref for leonardo', async () => {
    await expect(
      deliver({
        provider_code: 'leonardo',
        role: 'start_frame',
        url: 'https://cdn.example/a.jpg',
      }),
    ).resolves.toEqual({ delivery: 'UPLOAD', ref: 'init-image://pending' });
  });

  it('returns UPLOAD multipart pending for topaz', async () => {
    await expect(
      deliver({
        provider_code: 'topaz',
        role: 'source_image',
        url: 'https://cdn.example/a.jpg',
      }),
    ).resolves.toEqual({ delivery: 'UPLOAD', ref: 'multipart://pending' });
  });

  it('returns URL delivery for kling with HTTPS url', async () => {
    const url = 'https://cdn.example/video.mp4';
    await expect(
      deliver({
        provider_code: 'kling',
        role: 'start_frame',
        url,
      }),
    ).resolves.toEqual({ delivery: 'URL', ref: url });
  });

  it('rejects url longer than 2048 chars', async () => {
    const url = `https://cdn.example/${'a'.repeat(2048)}`;
    await expect(
      deliver({
        provider_code: 'kling',
        role: 'start_frame',
        url,
      }),
    ).rejects.toMatchObject({ error_class: 'input_asset' });
  });
});
