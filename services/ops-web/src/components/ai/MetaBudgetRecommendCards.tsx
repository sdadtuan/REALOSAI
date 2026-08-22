'use client';

import { MetaBudgetRecommendCard } from '@/components/meta/MetaBudgetRecommendCard';

/** WIN-4-C — read-only budget recommend cards for Meta hub + agency client. */
export function MetaBudgetRecommendCards({
  token,
  clientId,
}: {
  token: string;
  clientId?: string;
}) {
  return <MetaBudgetRecommendCard token={token} clientId={clientId} />;
}
