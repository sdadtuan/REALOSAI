import { IVFFLAT_INDEX_NAME, parseIvfflatReadyRow } from './pgvector-ivfflat.util';

describe('pgvector-ivfflat.util', () => {
  it('P36 parseIvfflatReadyRow true only when IVFFlat index exists', () => {
    expect(parseIvfflatReadyRow({ idx_ok: true })).toBe(true);
    expect(parseIvfflatReadyRow({ idx_ok: false })).toBe(false);
    expect(parseIvfflatReadyRow(undefined)).toBe(false);
  });

  it('P36 index name matches DDL', () => {
    expect(IVFFLAT_INDEX_NAME).toBe('crm_research_emb_vec_ivf');
  });
});
