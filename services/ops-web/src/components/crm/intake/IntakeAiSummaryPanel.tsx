'use client';

interface Props {
  summary: string;
  disabled?: boolean;
  busy?: boolean;
  canGenerate?: boolean;
  onGenerate: () => void;
}

export function IntakeAiSummaryPanel({
  summary,
  disabled,
  busy,
  canGenerate = true,
  onGenerate,
}: Props) {
  const hasSummary = summary.trim().length > 0;

  return (
    <section className="intake-ai-summary stack-gap" aria-label='AI tóm tắt "AI Summary"'>
      <header className="intake-form__head intake-ai-summary__head">
        <h2 className="intake-form__title">D. AI tóm tắt &quot;AI Summary&quot;</h2>
        {canGenerate ? (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={disabled || busy}
            onClick={onGenerate}
          >
            {busy ? 'Đang tạo…' : hasSummary ? 'Tạo lại' : 'Tóm tắt AI'}
          </button>
        ) : null}
      </header>

      {hasSummary ? (
        <div className="intake-ai-summary__body">{summary}</div>
      ) : (
        <p className="muted intake-ai-summary__empty">
          Chưa có tóm tắt AI. Bấm <strong>Tóm tắt AI</strong> sau khi đã ghi discovery và chấm BANT.
        </p>
      )}
    </section>
  );
}
