import { describe, expect, it } from 'vitest';
import { g0BannerMessage, launchOpenBlockedTooltip, parseBdsApiErrorBody } from './g0-copy';

describe('g0-copy', () => {
  it('formats UX §6 required_roles banner', () => {
    expect(g0BannerMessage(['gdkd', 'truong_sp'])).toMatch(/Thiếu vị trí bắt buộc/);
    expect(g0BannerMessage(['gdkd', 'truong_sp'])).toMatch(/GĐ khối KD/);
  });

  it('launch tooltip includes banner text', () => {
    expect(launchOpenBlockedTooltip(['pm_du_an'])).toMatch(/Không thể mở ra quân/);
  });

  it('parses Nest BadRequest message wrapper', () => {
    expect(
      parseBdsApiErrorBody({
        message: { error: 'required_roles', missing: ['gdkd'] },
      }),
    ).toEqual({ error: 'required_roles', missing: ['gdkd'] });
  });
});
