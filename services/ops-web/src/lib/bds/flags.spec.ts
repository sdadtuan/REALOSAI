import { describe, expect, it, afterEach } from 'vitest';
import { isBdsNavHideB2bFeEnabled, isBdsUiFeEnabled } from './flags';

describe('bds flags', () => {
  const prev = process.env.NEXT_PUBLIC_PTT_BDS_UI;
  const prevNavHide = process.env.NEXT_PUBLIC_PTT_BDS_NAV_HIDE_B2B;
  afterEach(() => {
    if (prev === undefined) delete process.env.NEXT_PUBLIC_PTT_BDS_UI;
    else process.env.NEXT_PUBLIC_PTT_BDS_UI = prev;
    if (prevNavHide === undefined) delete process.env.NEXT_PUBLIC_PTT_BDS_NAV_HIDE_B2B;
    else process.env.NEXT_PUBLIC_PTT_BDS_NAV_HIDE_B2B = prevNavHide;
  });

  it('defaults UI off', () => {
    delete process.env.NEXT_PUBLIC_PTT_BDS_UI;
    expect(isBdsUiFeEnabled()).toBe(false);
  });

  it('UI on for 1', () => {
    process.env.NEXT_PUBLIC_PTT_BDS_UI = '1';
    expect(isBdsUiFeEnabled()).toBe(true);
  });

  it('defaults NAV_HIDE_B2B off', () => {
    delete process.env.NEXT_PUBLIC_PTT_BDS_NAV_HIDE_B2B;
    expect(isBdsNavHideB2bFeEnabled()).toBe(false);
  });
});
