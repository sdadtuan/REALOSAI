export function pickRoundRobinOwner(ids: string[], previousOwnerId: string | null): string | null {
  if (ids.length === 0) return null;
  if (previousOwnerId === null || !ids.includes(previousOwnerId)) {
    return ids[0] ?? null;
  }
  const index = ids.indexOf(previousOwnerId);
  return ids[(index + 1) % ids.length] ?? null;
}
