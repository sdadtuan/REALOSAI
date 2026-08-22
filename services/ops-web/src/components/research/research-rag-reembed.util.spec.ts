import { describe, expect, it } from 'vitest';
import {
  formatRagReembedResult,
  mapRagReembedErrorCode,
  RAG_REEMBED_BANNER,
  clampRagReembedLimit,
} from '@/components/research/research-rag-reembed.util';

describe('research-rag-reembed.util', () => {
  it('P40 banner mentions staging and no createInsight', () => {
    expect(RAG_REEMBED_BANNER).toMatch(/staging\/UAT/);
    expect(RAG_REEMBED_BANNER).toMatch(/Không tạo insight/);
  });

  it('mapRagReembedErrorCode maps API codes', () => {
    expect(mapRagReembedErrorCode('rag_disabled')).toMatch(/RAG chưa bật/);
    expect(mapRagReembedErrorCode('rag_reembed_disabled')).toMatch(/OpenAI embed/);
    expect(mapRagReembedErrorCode('forbidden')).toMatch(/configure/);
    expect(mapRagReembedErrorCode('jobs_disabled')).toMatch(/Worker/);
  });

  it('formatRagReembedResult includes processed and remaining', () => {
    const text = formatRagReembedResult({
      ok: true,
      status: 'succeeded',
      processed: 12,
      skipped_pii: 1,
      remaining: 3,
    });
    expect(text).toContain('Đã xử lý: 12');
    expect(text).toContain('Còn lại: 3');
  });

  it('clampRagReembedLimit bounds input', () => {
    expect(clampRagReembedLimit(0)).toBe(1);
    expect(clampRagReembedLimit(50)).toBe(50);
    expect(clampRagReembedLimit(999)).toBe(200);
  });
});
