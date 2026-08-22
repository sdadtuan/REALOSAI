export function isMarketResearchPortalFeEnabled(): boolean {
  return ['1', 'true', 'yes', 'on'].includes(
    (process.env.NEXT_PUBLIC_MARKET_RESEARCH ?? '0').trim().toLowerCase(),
  );
}
