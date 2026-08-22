import {
  MINIMAL_PNG_BUFFER,
  applyDraftWatermarkToBuffer,
  renderPlaceholderImageBuffer,
} from './content-media-watermark.util';

describe('content-media-watermark.util', () => {
  it('returns buffer for placeholder render', async () => {
    const buf = await renderPlaceholderImageBuffer({
      width: 320,
      height: 320,
      title: 'Title',
      subtitle: 'Subtitle',
      stylePreset: 'corporate',
      seed: 'abc123',
    });
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(0);
  });

  it('passes through when watermark disabled', async () => {
    const input = MINIMAL_PNG_BUFFER;
    const out = await applyDraftWatermarkToBuffer(input, false);
    expect(out).toBe(input);
  });
});
