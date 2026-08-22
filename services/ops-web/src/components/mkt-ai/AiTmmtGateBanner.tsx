'use client';

interface Props {
  ok: boolean;
  filledCount?: number;
  messages: string[];
  onOpenTmmt?: () => void;
}

export function AiTmmtGateBanner({ ok, filledCount, messages, onOpenTmmt }: Props) {
  return (
    <div
      className="card"
      style={{
        padding: '0.65rem 1rem',
        marginBottom: '1rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '0.5rem',
        borderColor: ok ? 'rgba(22, 163, 74, 0.35)' : 'rgba(220, 38, 38, 0.35)',
        background: ok ? 'rgba(22, 163, 74, 0.08)' : 'rgba(220, 38, 38, 0.06)',
      }}
    >
      <div>
        {ok ? (
          <span style={{ color: 'var(--accent)', fontWeight: 600 }}>
            Gate TMMT ✓ — có thể chuyển Deliver
          </span>
        ) : (
          <>
            <span className="error" style={{ fontWeight: 600 }}>
              Gate TMMT chưa pass
              {filledCount != null ? ` · ${filledCount}/12 mục TMMT chi tiết` : ''}
            </span>
            {messages.length > 0 ? (
              <ul className="error" style={{ margin: '0.35rem 0 0', paddingLeft: '1.1rem', fontSize: '0.85rem' }}>
                {messages.slice(0, 3).map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            ) : null}
          </>
        )}
      </div>
      {onOpenTmmt ? (
        <button type="button" className="btn btn-sm btn-ghost" onClick={onOpenTmmt}>
          Mở tab TMMT →
        </button>
      ) : null}
    </div>
  );
}
