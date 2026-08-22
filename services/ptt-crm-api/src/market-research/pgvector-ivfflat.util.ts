export const IVFFLAT_INDEX_NAME = 'crm_research_emb_vec_ivf';

export const IVFFLAT_READY_SQL = `
  SELECT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'crm_research_insight_embeddings'
      AND indexname = '${IVFFLAT_INDEX_NAME}'
  ) AS idx_ok
`;

export function parseIvfflatReadyRow(row: { idx_ok?: boolean } | undefined): boolean {
  return Boolean(row?.idx_ok);
}
