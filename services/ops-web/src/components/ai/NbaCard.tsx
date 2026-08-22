'use client';

interface PlaybookCitation {
  playbook_id: string;
  playbook_title: string;
  chunk_id: string;
  chunk_title: string;
  excerpt: string;
}

interface Props {
  actionLabel: string;
  reason: string;
  confidence?: number;
  loading?: boolean;
  playbookCitation?: PlaybookCitation | null;
  onAccept?: () => void;
  onDismiss?: () => void;
}

export function NbaCard({
  actionLabel,
  reason,
  confidence,
  loading,
  playbookCitation,
  onAccept,
  onDismiss,
}: Props) {
  const playbookHref = playbookCitation?.playbook_id
    ? `/crm/playbooks?playbook=${encodeURIComponent(playbookCitation.playbook_id)}&q=${encodeURIComponent(playbookCitation.chunk_title || actionLabel)}`
    : '/crm/playbooks';

  return (
    <section className="nba-card" aria-label="Next best action">
      <div className="nba-card__header">
        <span className="nba-card__badge">NBA</span>
        <h4 className="nba-card__title">{actionLabel}</h4>
      </div>
      <p className="nba-card__reason">{reason}</p>
      {playbookCitation ? (
        <div className="nba-card__playbook">
          <p className="muted nba-card__playbook-label">Playbook RAG</p>
          <p className="nba-card__playbook-excerpt">{playbookCitation.excerpt}</p>
          <a className="nba-card__playbook-link" href={playbookHref}>
            {playbookCitation.playbook_title} · {playbookCitation.chunk_title}
          </a>
        </div>
      ) : (
        <p className="muted">
          <a className="nba-card__playbook-link" href="/crm/playbooks">
            Xem thư viện playbook
          </a>
        </p>
      )}
      {confidence != null ? (
        <p className="muted nba-card__confidence">Độ tin cậy: {Math.round(confidence * 100)}%</p>
      ) : null}
      <div className="nba-card__actions">
        <button type="button" className="btn btn-primary btn-sm" disabled={loading} onClick={onAccept}>
          Chấp nhận
        </button>
        <button type="button" className="btn btn-secondary btn-sm" disabled={loading} onClick={onDismiss}>
          Bỏ
        </button>
      </div>
    </section>
  );
}
