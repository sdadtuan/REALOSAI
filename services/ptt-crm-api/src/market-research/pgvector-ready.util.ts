export const PGVECTOR_READY_SQL = `
  SELECT EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'vector'
  ) AS ext_ok,
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'crm_research_insight_embeddings'
      AND column_name = 'embedding_vec'
  ) AS col_ok
`;

export function parsePgvectorReadyRow(row: { ext_ok?: boolean; col_ok?: boolean } | undefined): boolean {
  return Boolean(row?.ext_ok && row?.col_ok);
}
