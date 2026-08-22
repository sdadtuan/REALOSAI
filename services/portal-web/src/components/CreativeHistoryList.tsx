'use client';

import type { CreativeRow } from '@/lib/api';
import { fmtDate } from '@/lib/format';

interface CreativeHistoryListProps {
  rows: CreativeRow[];
}

const STATUS_LABEL: Record<string, string> = {
  approved: 'Đã duyệt',
  rejected: 'Từ chối',
};

export function CreativeHistoryList({ rows }: CreativeHistoryListProps) {
  if (rows.length === 0) {
    return (
      <div className="card portal-empty-state">
        <p className="portal-empty-state__title">Chưa có lịch sử duyệt trong 30 ngày</p>
      </div>
    );
  }

  return (
    <div className="creative-history-list">
      {rows.map((row) => (
        <article key={row.id} className="creative-card">
          <div className="creative-history-card__head">
            <div>
              <h3 className="creative-card__title">{row.title}</h3>
              <p className="muted creative-card__meta">
                v{row.version}
                {row.external_campaign_name ? ` · ${row.external_campaign_name}` : ''}
              </p>
              <p className="muted notification-card__time">
                {row.reviewed_by ? `Bởi ${row.reviewed_by}` : ''}
                {row.reviewed_at ? ` · ${fmtDate(row.reviewed_at.slice(0, 10))}` : ''}
              </p>
              {row.review_note ? <p className="creative-card__desc">{row.review_note}</p> : null}
            </div>
            <span
              className={`badge${row.status === 'rejected' ? ' badge-warn' : row.status === 'approved' ? ' badge-success' : ''}`}
            >
              {STATUS_LABEL[row.status] ?? row.status}
            </span>
          </div>
        </article>
      ))}
    </div>
  );
}
