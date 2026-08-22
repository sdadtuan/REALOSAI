import { describe, expect, it, afterEach } from 'vitest';
import { isBdsUiFeEnabled } from './flags';

describe('bds flags', () => {
  const prev = process.env.NEXT_PUBLIC_PTT_BDS_UI;
  afterEach(() => {
    if (prev === undefined) delete process.env.NEXT_PUBLIC_PTT_BDS_UI;
    else process.env.NEXT_PUBLIC_PTT_BDS_UI = prev;
  });

  it('defaults UI off', () => {
    delete process.env.NEXT_PUBLIC_PTT_BDS_UI;
    expect(isBdsUiFeEnabled()).toBe(false);
  });

  it('UI on for 1', () => {
    process.env.NEXT_PUBLIC_PTT_BDS_UI = '1';
    expect(isBdsUiFeEnabled()).toBe(true);
  });
});
