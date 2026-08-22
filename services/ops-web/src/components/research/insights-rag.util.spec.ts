import { describe, expect, it } from 'vitest';
import { RAG_SEARCH_BANNER, shouldShowRagSearch } from './insights-rag.util';

describe('insights-rag.util', () => {
  it('keeps RAG search banner verbatim', () => {
    expect(RAG_SEARCH_BANNER).toBe(
      'Chỉ insight đã duyệt bản khách / published. Không tìm draft. Không tự tạo insight.',
    );
  });

  it('hides RAG search when health.rag_enabled is false', () => {
    expect(shouldShowRagSearch(false, true)).toBe(false);
    expect(shouldShowRagSearch(false, false)).toBe(false);
  });

  it('shows RAG search only when rag is enabled and actor can view', () => {
    expect(shouldShowRagSearch(true, true)).toBe(true);
    expect(shouldShowRagSearch(true, false)).toBe(false);
  });
});
