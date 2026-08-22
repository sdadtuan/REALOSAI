import { ApiError } from './api';

export function phoneTelHref(phone: string): string {
  const normalized = phone.replace(/[^\d+]/g, '');
  return normalized ? `tel:${normalized}` : '#';
}

export function shouldTelFallbackOnCallError(err: unknown): boolean {
  return err instanceof ApiError && err.status === 503;
}
