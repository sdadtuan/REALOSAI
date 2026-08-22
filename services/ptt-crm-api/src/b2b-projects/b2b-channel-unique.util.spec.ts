import { assertChannelKeyAvailable } from './b2b-channel-unique.util';

describe('assertChannelKeyAvailable', () => {
  const existing = [
    { kind: 'form_id' as const, value: 'F1', projectId: 'p1', active: true },
    { kind: 'page_id' as const, value: 'PG1', projectId: 'p1', active: true },
  ];

  it('allows same form on same project', () => {
    expect(() =>
      assertChannelKeyAvailable(existing, { kind: 'form_id', value: 'F1', projectId: 'p1', active: true }),
    ).not.toThrow();
  });

  it('rejects active form on another project', () => {
    expect(() =>
      assertChannelKeyAvailable(existing, { kind: 'form_id', value: 'F1', projectId: 'p2', active: true }),
    ).toThrow(/form_id/);
  });

  it('allows inactive duplicate', () => {
    expect(() =>
      assertChannelKeyAvailable(existing, { kind: 'form_id', value: 'F1', projectId: 'p2', active: false }),
    ).not.toThrow();
  });

  it('rejects oa_id clash', () => {
    const rows = [{ kind: 'oa_id' as const, value: 'OA9', projectId: 'p1', active: true }];
    expect(() =>
      assertChannelKeyAvailable(rows, { kind: 'oa_id', value: 'OA9', projectId: 'p2', active: true }),
    ).toThrow(/oa_id/);
  });
});
