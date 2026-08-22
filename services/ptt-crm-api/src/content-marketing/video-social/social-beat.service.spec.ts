import { parseBeats } from './social-beat.service';

describe('social-beat.service', () => {
  it('always returns 4 beats hook-pain-proof-cta', () => {
    const beats = parseBeats('Hook ngắn.\n\nPain đây.\n\nProof số.\n\nCTA liên hệ.', 28);
    expect(beats.map((b) => b.id)).toEqual(['hook', 'pain', 'proof', 'cta']);
    expect(beats[0].end_ms).toBe(3000);
  });

  it('works with a single paragraph', () => {
    expect(parseBeats('Chỉ một đoạn dài về dịch vụ PTT ads.', 20)).toHaveLength(4);
  });
});
