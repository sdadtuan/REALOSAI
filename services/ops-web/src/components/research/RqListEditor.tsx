export type RqDraft = { question_vi: string; question_en?: string };

type RqListEditorProps = {
  items: RqDraft[];
  onChange: (items: RqDraft[]) => void;
  disabled?: boolean;
};

export function RqListEditor({ items, onChange, disabled }: RqListEditorProps) {
  function update(index: number, patch: Partial<RqDraft>) {
    onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  return (
    <div className="stack-gap">
      {items.map((item, index) => (
        <div key={index} className="card" style={{ padding: '0.75rem' }}>
          <label className="muted" htmlFor={`rq-vi-${index}`}>
            Câu hỏi {index + 1} (tiếng Việt)
          </label>
          <textarea
            id={`rq-vi-${index}`}
            className="kpi-input"
            rows={2}
            value={item.question_vi}
            disabled={disabled}
            onChange={(e) => update(index, { question_vi: e.target.value })}
            placeholder="Ví dụ: Quy mô thị trường sữa uống VN 2025–26?"
            style={{ width: '100%', marginTop: 4 }}
          />
          <details style={{ marginTop: 8 }}>
            <summary className="muted">Câu hỏi tiếng Anh (tuỳ chọn)</summary>
            <input
              className="kpi-input"
              value={item.question_en ?? ''}
              disabled={disabled}
              onChange={(e) => update(index, { question_en: e.target.value })}
              style={{ width: '100%', marginTop: 6 }}
            />
          </details>
          {items.length > 1 ? (
            <button
              type="button"
              className="btn btn-sm btn-secondary"
              disabled={disabled}
              onClick={() => onChange(items.filter((_, i) => i !== index))}
              style={{ marginTop: 8 }}
            >
              Xoá
            </button>
          ) : null}
        </div>
      ))}
      <button
        type="button"
        className="btn btn-sm btn-secondary"
        disabled={disabled}
        onClick={() => onChange([...items, { question_vi: '' }])}
      >
        + Thêm câu hỏi
      </button>
    </div>
  );
}
