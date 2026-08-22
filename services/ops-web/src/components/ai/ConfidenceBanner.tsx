'use client';

interface Props {
  confidence: number;
  threshold?: number;
}

/** BR-AI-02 — low confidence warning banner. */
export function ConfidenceBanner({ confidence, threshold = 0.6 }: Props) {
  if (confidence >= threshold) return null;
  const pct = Math.round(confidence * 100);
  return (
    <div className="ai-confidence-banner" role="status" aria-live="polite">
      <span aria-hidden="true">⚠</span>
      <span>
        Độ tin cậy thấp ({pct}%) — kiểm tra kỹ trước khi dùng gợi ý AI.
      </span>
    </div>
  );
}
