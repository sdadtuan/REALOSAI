import { describe, expect, it } from 'vitest';
import { RAG_COPILOT_BANNER, shouldShowRagCopilotBanner } from './insight-copilot-rag.util';

describe('insight-copilot-rag.util', () => {
  it('keeps RAG copilot banner verbatim', () => {
    expect(RAG_COPILOT_BANNER).toBe(
      'Copilot có thể tham chiếu insight đã duyệt cùng khách. Bản nháp — không tự duyệt, không tự công bố.',
    );
  });

  it('hides RAG copilot banner when health.rag_enabled is false', () => {
    expect(shouldShowRagCopilotBanner(false, true)).toBe(false);
    expect(shouldShowRagCopilotBanner(false, false)).toBe(false);
  });

  it('shows RAG copilot banner only when rag is enabled and actor can run', () => {
    expect(shouldShowRagCopilotBanner(true, true)).toBe(true);
    expect(shouldShowRagCopilotBanner(true, false)).toBe(false);
  });
});
