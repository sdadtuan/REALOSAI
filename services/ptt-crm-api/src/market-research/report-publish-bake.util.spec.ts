import { bakePublishedValidTo } from './report-publish-bake.util';

describe('report-publish-bake.util', () => {
  it('P32 stamps published_valid_to from map', () => {
    const out = bakePublishedValidTo(
      { findings: [{ insight_id: 11, text: 'x' }], recs: [{ insight_id: 11, text: 'r' }] },
      new Map([[11, '2026-12-31']]),
    );
    expect(out.findings[0]).toMatchObject({ insight_id: 11, published_valid_to: '2026-12-31' });
    expect(out.recs[0]).toMatchObject({ published_valid_to: '2026-12-31' });
  });

  it('P32 null when id missing from map', () => {
    const out = bakePublishedValidTo(
      { findings: [{ insight_id: 99, text: 'x' }], recs: [] },
      new Map(),
    );
    expect(out.findings[0]).toMatchObject({ published_valid_to: null });
  });
});
