import { describe, expect, it } from 'vitest';
import { ISO_GAP_BANNER } from '@/components/research/iso-gap-panel.util';

describe('iso-gap-panel.util', () => {
  it('P37 banner does not claim ISO certification', () => {
    expect(ISO_GAP_BANNER).toMatch(/Gap-check nội bộ/);
    expect(ISO_GAP_BANNER).toMatch(/không chứng nhận/);
    expect(ISO_GAP_BANNER).not.toMatch(/ISO certified|đạt chuẩn ISO 20252/i);
  });
});
