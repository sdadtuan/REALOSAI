import type { VdErrorClass } from '../jobs/vd-job.types';

export type { VdErrorClass };

export class ProviderError extends Error {
  constructor(
    readonly error_class: VdErrorClass,
    message: string,
    readonly retryAfterSec?: number,
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}

export function mapHttpToErrorClass(status: number, code?: string): VdErrorClass {
  if (code === 'SAFETY.INPUT.1') return 'moderation';
  if (status === 429 && code === 'insufficient_quota') return 'budget';

  switch (status) {
    case 401:
    case 403:
      return 'auth';
    case 400:
      return 'validation';
    case 402:
      return 'budget';
    case 429:
      return 'rate_limit';
    case 409:
    case 425:
      return 'not_ready';
    case 500:
    case 502:
    case 503:
      return 'transient';
    case 504:
      return 'timeout';
    default:
      return 'provider';
  }
}
