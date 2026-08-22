import { parsePgvectorReadyRow } from './pgvector-ready.util';

describe('pgvector-ready.util', () => {
  it('P26 parsePgvectorReadyRow true only when extension and column exist', () => {
    expect(parsePgvectorReadyRow({ ext_ok: true, col_ok: true })).toBe(true);
    expect(parsePgvectorReadyRow({ ext_ok: true, col_ok: false })).toBe(false);
    expect(parsePgvectorReadyRow({ ext_ok: false, col_ok: true })).toBe(false);
    expect(parsePgvectorReadyRow(undefined)).toBe(false);
  });
});
