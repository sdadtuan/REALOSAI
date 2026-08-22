export function parseCinematicDailyCap(raw: string | undefined): number {
  const capRaw = Number(raw ?? 1);
  return Number.isFinite(capRaw) && capRaw > 0 ? Math.max(1, Math.floor(capRaw)) : 1;
}

export function assertCinematicEnabled(config: { contentMarketingVideoCinematicEnabled: boolean }): void {
  if (!config.contentMarketingVideoCinematicEnabled) {
    throw new Error('cmkt_cinematic_disabled');
  }
}
