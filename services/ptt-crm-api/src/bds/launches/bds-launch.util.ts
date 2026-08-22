import { DEFAULT_HOLD_TTL_SECONDS, type LaunchStatus } from './bds-launch.types';

export { DEFAULT_HOLD_TTL_SECONDS };

export function computeLaunchExpiresAt(now: Date, ttlSeconds: number): Date {
  const sec = Number.isFinite(ttlSeconds) && ttlSeconds > 0 ? ttlSeconds : DEFAULT_HOLD_TTL_SECONDS;
  return new Date(now.getTime() + sec * 1000);
}

export function canOpenLaunch(status: string): boolean {
  return status === 'draft';
}

export function canCloseLaunch(status: string): boolean {
  return status === 'open';
}

export function ttlRemainingSec(expiresAt: Date | null, now = new Date()): number | null {
  if (!expiresAt) return null;
  return Math.max(0, Math.round((expiresAt.getTime() - now.getTime()) / 1000));
}

export function isLaunchStatus(raw: string): raw is LaunchStatus {
  return raw === 'draft' || raw === 'open' || raw === 'closed';
}
