/** Sprint 0 F1 — Deal Room client flag */

export function dealRoomEnabled(): boolean {
  return (process.env.NEXT_PUBLIC_DEAL_ROOM ?? '0').trim().toLowerCase() !== '0';
}
