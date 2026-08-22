import { HttpException, HttpStatus, Injectable } from '@nestjs/common';

/** In-memory per-actor sliding window — RNOS-03 rate limit (429). */
@Injectable()
export class AiSummarizeRateLimitService {
  private readonly buckets = new Map<string, number[]>();

  check(actorKey: string, limitPerMinute: number): void {
    const limit = Math.max(1, limitPerMinute);
    const now = Date.now();
    const windowMs = 60_000;
    const key = actorKey.trim() || 'anonymous';
    const prev = (this.buckets.get(key) ?? []).filter((ts) => now - ts < windowMs);

    if (prev.length >= limit) {
      const oldest = prev[0] ?? now;
      const retryAfterSec = Math.max(1, Math.ceil((windowMs - (now - oldest)) / 1000));
      throw new HttpException(
        {
          error: 'summarize_rate_limited',
          message: 'Thử lại sau 1 phút',
          retry_after_sec: retryAfterSec,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    prev.push(now);
    this.buckets.set(key, prev);
  }

  reset(): void {
    this.buckets.clear();
  }
}
