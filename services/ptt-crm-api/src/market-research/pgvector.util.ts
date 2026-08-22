export function toPgvectorLiteral(values: number[]): string {
  if (!values.length || values.some((n) => !Number.isFinite(n))) {
    throw new Error('invalid_pgvector');
  }
  return `[${values.join(',')}]`;
}

export function shouldUsePgvectorAnn(
  flag: boolean,
  pgvectorReady: boolean,
  queryVec: number[] | undefined,
): boolean {
  return Boolean(flag && pgvectorReady && queryVec && queryVec.length > 0);
}
