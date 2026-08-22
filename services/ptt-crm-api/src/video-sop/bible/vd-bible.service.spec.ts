import { composePrompt, mergeLockRegions } from './vd-bible.service';

describe('composePrompt', () => {
  it('keeps locked region tokens', () => {
    const out = composePrompt('walk {{lock:face}}', { lock_regions: ['face'] });
    expect(out).toContain('{{lock:face}}');
  });

  it('strips lock token when region not locked', () => {
    const out = composePrompt('walk {{lock:face}}', { lock_regions: [] });
    expect(out).not.toContain('{{lock:face}}');
  });
});

describe('mergeLockRegions', () => {
  it('merges unique regions from characters', () => {
    expect(
      mergeLockRegions([
        { name: 'A', lock_regions: ['face', 'hair'], notes: '' },
        { name: 'B', lock_regions: ['face'], notes: '' },
      ]),
    ).toEqual(['face', 'hair']);
  });
});
