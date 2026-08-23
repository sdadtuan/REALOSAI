export type CskhBoardFlow = 're_buyer' | 'spa';

export function resolveCskhBoardFlow(input: {
  requested?: string | null;
  hasCrmLeadsView: boolean;
  hasBdsBuyersView: boolean;
}): CskhBoardFlow | null {
  const req = String(input.requested ?? '').trim();
  if (req === 're_buyer') {
    return input.hasCrmLeadsView || input.hasBdsBuyersView ? 're_buyer' : null;
  }
  if (input.hasCrmLeadsView) return 'spa';
  if (input.hasBdsBuyersView) return 're_buyer';
  return null;
}
