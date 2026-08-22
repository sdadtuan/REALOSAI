import type { HoldActor, HoldStatus } from './bds-hold.types';

export function decideHoldActor(channelPartnerId?: string): HoldActor {
  return String(channelPartnerId ?? '').trim() ? 'channel' : 'inhouse';
}

export function initialHoldStatus(
  actor: HoldActor,
  autoApproveInternal: boolean,
): HoldStatus {
  if (actor === 'channel') return 'pending';
  return autoApproveInternal ? 'active' : 'pending';
}

export function ttlMinutes(projectStatus: string, tenantTtlMinutes?: number): number {
  if (Number.isFinite(tenantTtlMinutes) && Number(tenantTtlMinutes) > 0) {
    return Number(tenantTtlMinutes);
  }
  return String(projectStatus) === 'selling' ? 1440 : 30;
}

export function computeExpiresAt(now: Date, minutes: number): Date {
  return new Date(now.getTime() + minutes * 60_000);
}
