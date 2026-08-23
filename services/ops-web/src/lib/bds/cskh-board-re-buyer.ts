export type CskhBoardFlowParam = 're_buyer' | undefined;

export function showReBuyerBoardColumns(flow: CskhBoardFlowParam): boolean {
  return flow === 're_buyer';
}

export function isHoldTtlOverdue(expiresAt: string | null | undefined, now = Date.now()): boolean {
  if (!expiresAt) return false;
  const ts = Date.parse(expiresAt);
  return Number.isFinite(ts) && ts < now;
}
