import { HttpException, HttpStatus } from '@nestjs/common';
import { AiSummarizeRateLimitService } from './ai-summarize-rate-limit.service';

describe('AiSummarizeRateLimitService', () => {
  it('allows requests under limit', () => {
    const svc = new AiSummarizeRateLimitService();
    svc.check('staff-1', 3);
    svc.check('staff-1', 3);
    svc.check('staff-1', 3);
  });

  it('throws 429 when limit exceeded', () => {
    const svc = new AiSummarizeRateLimitService();
    for (let i = 0; i < 2; i += 1) {
      svc.check('staff-2', 2);
    }
    expect(() => svc.check('staff-2', 2)).toThrow(HttpException);
    try {
      svc.check('staff-2', 2);
    } catch (err) {
      expect(err).toBeInstanceOf(HttpException);
      expect((err as HttpException).getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
    }
  });
});
